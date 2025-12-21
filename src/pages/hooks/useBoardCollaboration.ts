import { useEffect, useMemo, useRef, useState } from 'react';
import type { BoardEvent } from '../../domain/types';
import type { BoardRole, PresencePayload, PresenceUser } from '../../../shared/protocol';
import { CollabClient, type CollabStatus } from '../../collab/CollabClient';
import { getSupabaseClient, isSupabaseConfigured } from '../../supabase/supabaseClient';

function getInviteTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const q = url.searchParams.get('invite');
  if (q) return q.trim();

  // Allow #invite=TOKEN (useful when query params are hard to share)
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const m = /(?:^|&)invite=([^&]+)/.exec(hash);
  if (m?.[1]) return decodeURIComponent(m[1]).trim();

  // If invite token was passed as 'invite=TOKEN'
  const raw = url.searchParams.toString();
  if (raw.startsWith('invite=')) return decodeURIComponent(raw.slice('invite='.length)).trim();

  return null;
}

function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return 'guest';
  const key = 'pwa-whiteboard.guestId';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next = 'g_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
  window.localStorage.setItem(key, next);
  return next;
}

export type UseBoardCollaborationArgs = {
  boardId: string | undefined;
  boardName?: string;
  resetBoard: (next: any) => void;
  applyRemoteEvent: (event: BoardEvent) => void;
};

export type UseBoardCollaborationResult = {
  enabled: boolean;
  status: CollabStatus | 'disabled';
  errorText?: string;
  role?: BoardRole;
  users: PresenceUser[];
  presenceByUserId: Record<string, PresencePayload>;
  inviteToken?: string;
  guestId: string;
  sendOp: (event: BoardEvent) => void;
  sendPresence: (presence: PresencePayload) => void;
};

export function useBoardCollaboration({
  boardId,
  boardName,
  resetBoard,
  applyRemoteEvent,
}: UseBoardCollaborationArgs): UseBoardCollaborationResult {
  const baseUrl = (globalThis as any).__VITE_COLLAB_BASE_URL as string | undefined;
  const inviteToken = useMemo(() => getInviteTokenFromUrl(), []);
  const guestId = useMemo(() => getOrCreateGuestId(), []);

  const enabled = Boolean(baseUrl) && Boolean(boardId);

  const [status, setStatus] = useState<CollabStatus | 'disabled'>(enabled ? 'idle' : 'disabled');
  const [errorText, setErrorText] = useState<string | undefined>(undefined);
  const [role, setRole] = useState<BoardRole | undefined>(undefined);
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, PresencePayload>>({});
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);

  const clientRef = useRef<CollabClient | null>(null);
  const clientKeyRef = useRef<string | null>(null);

  const resetBoardRef = useRef(resetBoard);
  const applyRemoteEventRef = useRef(applyRemoteEvent);
  useEffect(() => {
    resetBoardRef.current = resetBoard;
  }, [resetBoard]);
  useEffect(() => {
    applyRemoteEventRef.current = applyRemoteEvent;
  }, [applyRemoteEvent]);

  const [supabaseJwt, setSupabaseJwt] = useState<string | null>(null);
  const [boardEnsured, setBoardEnsured] = useState<boolean>(false);

  // Fetch a Supabase JWT for owner-mode joins (when no invite token is present).
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!isSupabaseConfigured()) return;
      if (inviteToken) {
        setSupabaseJwt(null);
        return;
      }
      const client = getSupabaseClient();
      const { data } = await client.auth.getSession();
      const jwt = data.session?.access_token ?? null;
      if (!cancelled) setSupabaseJwt(jwt);
    }
    run().catch((err) => console.error('Failed to get supabase session', err));
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const auth = useMemo(() => {
    if (inviteToken) return { kind: 'invite', inviteToken } as const;
    if (supabaseJwt) return { kind: 'owner', supabaseJwt } as const;
    return null;
  }, [inviteToken, supabaseJwt]);


  // Ensure the board exists in Supabase before the owner joins collab.
  useEffect(() => {
  let cancelled = false;
  async function run() {
    // Invite-based sessions don't create boards in Supabase.
    if (!boardId) { setBoardEnsured(false); return; }
    if (inviteToken) { setBoardEnsured(true); return; }
    if (!isSupabaseConfigured()) { setBoardEnsured(true); return; }
    const client = getSupabaseClient();
    const { data } = await client.auth.getSession();
    const sess = data.session;
    if (!sess) { setBoardEnsured(false); return; }

    // Upsert board row (owner-only) so the Worker can find it during join.
    const title = (boardName && boardName.trim()) ? boardName.trim() : 'Untitled board';
    const { error } = await client
      .schema('whiteboard')
      .from('boards')
      .upsert(
        {
          id: boardId,
          owner_user_id: sess.user.id,
          title,
        },
        { onConflict: 'id' }
      );

    if (cancelled) return;
    if (error) {
      console.error('Failed to ensure board exists in Supabase', error);
      // Don't hard-fail collaboration; the Worker might still allow join if it creates the row.
      setBoardEnsured(true);
      return;
    }
    setBoardEnsured(true);
  }

  // Reset ensure status when board changes.
  setBoardEnsured(false);
  run().catch((err) => {
    console.error('Failed to ensure board exists in Supabase', err);
    setBoardEnsured(true);
  });

  return () => { cancelled = true; };
  }, [boardId, boardName, inviteToken]);
  useEffect(() => {
    if (!cooldownUntil) return;
    const now = Date.now();
    if (cooldownUntil <= now) return;
    const t = window.setTimeout(() => setCooldownUntil(0), cooldownUntil - now);
    return () => window.clearTimeout(t);
  }, [cooldownUntil]);

  useEffect(() => {
    if (!enabled || !baseUrl || !auth || !boardId) {
      clientRef.current?.close();
      clientRef.current = null;
      clientKeyRef.current = null;
      setStatus(enabled ? 'idle' : 'disabled');
      return;
    }

    // Owner-mode requires the board row to exist in Supabase before we join.
    if (auth.kind === 'owner' && !boardEnsured) {
      setStatus('connecting');
      return;
    }

    // Cooldown after rate-limit errors (prevents reconnect storms)
    if (cooldownUntil && Date.now() < cooldownUntil) {
      setStatus('error');
      setErrorText('Too many join attempts; cooling down…');
      return;
    }

    const authKey = auth.kind === 'invite' ? `invite:${auth.inviteToken}` : `owner:${auth.supabaseJwt}`;
    const key = `${baseUrl}|${boardId}|${guestId}|${authKey}`;

    if (clientRef.current && clientKeyRef.current === key) return;

    clientRef.current?.close();
    clientRef.current = null;

    const client = new CollabClient(
      {
        baseUrl,
        boardId,
        auth,
        guestId,
        displayName: 'Guest',
      },
      {
        onStatus: (s, err) => {
          setStatus(s);
          if (s === 'error' || s === 'closed') setErrorText(err);
          if (s === 'connected') setErrorText(undefined);
        },
        onJoined: (msg) => {
          setRole(msg.role);
          setUsers(msg.users ?? []);
          setPresenceByUserId(msg.presenceByUserId ?? {});
          if (msg.snapshot) resetBoardRef.current(msg.snapshot);
        },
        onOp: (msg) => {
          if (msg.op) applyRemoteEventRef.current(msg.op as any);
        },
        onPresence: (msg) => {
          setUsers(msg.users ?? []);
          setPresenceByUserId(msg.presenceByUserId ?? {});
        },
        onErrorMsg: (msg) => {
          const err = `${msg.code}: ${msg.message}`;
          console.error('Collab server error:', err, msg);
          setStatus('error');
          setErrorText(err);
          if (msg.message?.includes('Too many join attempts')) {
            setCooldownUntil(Date.now() + 30_000);
          }
        },
      }
    );

    clientRef.current = client;
    clientKeyRef.current = key;
    client.connect();

    return () => {
      if (clientRef.current === client) {
        client.close();
        clientRef.current = null;
        clientKeyRef.current = null;
      }
    };
  }, [enabled, baseUrl, auth, boardId, guestId, cooldownUntil, boardEnsured]);

  const sendOp = (event: BoardEvent) => {
    if (!enabled || status !== 'connected' || !boardId) return;
    clientRef.current?.sendOp(event as any, boardId);
  };

  const sendPresence = (presence: PresencePayload) => {
    if (!enabled || status !== 'connected' || !boardId) return;
    clientRef.current?.sendPresence(boardId, presence);
  };

  return {
    enabled,
    status,
    errorText,
    role,
    users,
    presenceByUserId,
    inviteToken: inviteToken ?? undefined,
    guestId,
    sendOp,
    sendPresence,
  };
}
