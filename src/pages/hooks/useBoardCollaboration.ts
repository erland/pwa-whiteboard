import { useEffect, useMemo, useRef, useState } from 'react';
import type { BoardEvent } from '../../domain/types';
import type { BoardRole, PresencePayload, PresenceUser } from '../../../shared/protocol';
import { CollabClient, type CollabStatus } from '../../collab/CollabClient';
import { getSupabaseClient, isSupabaseConfigured } from '../../supabase/supabaseClient';
import { getBestLocalBoardTitle } from '../../domain/boardTitle';
import { ensureBoardRowInSupabase, updateBoardTitleInSupabase } from '../../supabase/boards';

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
  boardMetaId?: string;
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
  boardMetaId,
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
// Important: do NOT flip boardEnsured back to false just because the title becomes available later;
// otherwise React effect cleanups will close the websocket mid-connect.
const ensuredBoardIdRef = useRef<string | null>(null);

useEffect(() => {
  let cancelled = false;
  async function ensureRow() {
    if (!boardId) {
      ensuredBoardIdRef.current = null;
      setBoardEnsured(false);
      return;
    }
    if (inviteToken) {
      // Invite-based sessions don't create boards in Supabase.
      ensuredBoardIdRef.current = boardId;
      setBoardEnsured(true);
      return;
    }
    if (!isSupabaseConfigured()) {
      // No Supabase configured => can't ensure; treat as ensured so local-only can still work.
      ensuredBoardIdRef.current = boardId;
      setBoardEnsured(true);
      return;
    }

    // Only reset when the boardId changes.
    if (ensuredBoardIdRef.current !== boardId) {
      setBoardEnsured(false);
    }

    const client = getSupabaseClient();
    const { data } = await client.auth.getSession();
    const sess = data.session;
    if (!sess) {
      setBoardEnsured(false);
      return;
    }

    const title = (await getBestLocalBoardTitle(boardId, boardName)) ?? 'Untitled board';

    const ensured = await ensureBoardRowInSupabase({
      client,
      boardId,
      ownerUserId: sess.user.id,
      title,
    });

    if (cancelled) return;
    if (!ensured.ok) {
      console.error('Failed to ensure board exists in Supabase', ensured.message);
      setErrorText(ensured.message);
      setBoardEnsured(false);
      return;
    }

    ensuredBoardIdRef.current = boardId;
    setBoardEnsured(true);
  }

  ensureRow().catch((err) => {
    console.error('Failed to ensure board exists in Supabase', err);
    setErrorText(`Supabase ensure failed: ${String(err)}`);
    setBoardEnsured(false);
  });

  return () => {
    cancelled = true;
  };
}, [boardId, inviteToken, boardName]);

// If the owner renames a board later, update the title in Supabase without interrupting the websocket.
useEffect(() => {
  let cancelled = false;
  async function pushRename() {
    if (!boardId) return;
    if (inviteToken) return;
    if (!boardEnsured) return;
    if (!isSupabaseConfigured()) return;
    const title = boardName?.trim();
    if (!title) return;

    const client = getSupabaseClient();
    const { data } = await client.auth.getSession();
    const sess = data.session;
    if (!sess) return;

    const res = await updateBoardTitleInSupabase({ client, boardId, title });
    if (cancelled) return;
    if (!res.ok) console.warn('Failed to update board title in Supabase', res.message);
  }
  pushRename().catch((err) => console.error('Failed to update board title in Supabase', err));
  return () => {
    cancelled = true;
  };
}, [boardId, boardName, boardEnsured, inviteToken]);
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
    if (auth.kind === 'owner') {
      if (!boardEnsured) {
        setStatus('connecting');
        return;
      }
      if (boardMetaId && boardMetaId !== boardId) {
        setStatus('connecting');
        return;
      }
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
          if (msg.op) applyRemoteEventRef.current(msg.op);
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
  }, [enabled, baseUrl, auth, boardId, boardMetaId, guestId, cooldownUntil, boardEnsured]);

  const sendOp = (event: BoardEvent) => {
    if (!enabled || status !== 'connected' || !boardId) return;
    clientRef.current?.sendOp(event, boardId);
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
