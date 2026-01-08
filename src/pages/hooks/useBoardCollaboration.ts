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
  /** Non-fatal, user-facing notices (e.g. soft limits / rate limiting). */
  noticeText?: string;
  /** True while we are attempting to reconnect after having been connected. */
  isReconnecting: boolean;
  /** Whether this client has ever reached the "connected" state for this board. */
  hasEverConnected: boolean;
  role?: BoardRole;
  users: PresenceUser[];
  presenceByUserId: Record<string, PresencePayload>;
  inviteToken?: string;
  guestId: string;
  /** The userId key used in presence/users lists for this local client. */
  selfUserId: string;
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
  const [selfUserId, setSelfUserId] = useState<string>(guestId);

  const [status, setStatus] = useState<CollabStatus | 'disabled'>('disabled');
  const [errorText, setErrorText] = useState<string | undefined>(undefined);
  const [noticeText, setNoticeText] = useState<string | undefined>(undefined);
  const noticeTimerRef = useRef<number | null>(null);

  const [reconnectNonce, setReconnectNonce] = useState(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const hasEverConnectedRef = useRef(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
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

  // Keep a Supabase JWT for owner-mode joins (when no invite token is present).
  // Important: we must react to auth state changes; otherwise signing in while the board
  // is open won't trigger collaboration until the user reloads the page.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    if (inviteToken) {
      setSupabaseJwt(null);
      setSelfUserId(guestId);
      return;
    }

    const client = getSupabaseClient();
    if (!client) return;

    let cancelled = false;

    const syncFromSession = async () => {
      const { data } = await client.auth.getSession();
      const sess = data.session;
      if (cancelled) return;
      setSupabaseJwt(sess?.access_token ?? null);
      setSelfUserId(sess?.user?.id ?? guestId);
    };

    // Initial sync (covers already-signed-in users)
    syncFromSession().catch((err) => console.error('Failed to get supabase session', err));

    // Live updates (covers signing in/out while board stays open)
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setSupabaseJwt(session?.access_token ?? null);
      setSelfUserId(session?.user?.id ?? guestId);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [inviteToken, guestId]);

  const auth = useMemo(() => {
    if (inviteToken) return { kind: 'invite', inviteToken } as const;
    if (supabaseJwt) return { kind: 'owner', supabaseJwt } as const;
    return null;
  }, [inviteToken, supabaseJwt]);

  const enabled = Boolean(baseUrl) && Boolean(boardId) && Boolean(auth);

  // Keep status in sync with enabled/disabled transitions.
  useEffect(() => {
    if (!enabled) {
      setStatus('disabled');
    } else {
      // Don't force-reset to idle if we are already connecting/connected.
      setStatus((s) => (s === 'disabled' ? 'idle' : s));
    }
  }, [enabled]);

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
    if (!client) {
      setBoardEnsured(false);
      return;
    }
    const { data } = await client.auth.getSession();
    const sess = data.session;
    if (!sess) {
      setBoardEnsured(false);
      return;
    }

    setSelfUserId(sess.user.id);

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
}, [boardId, inviteToken, boardName, supabaseJwt]);

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
    if (!client) return;
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
    const key = `${baseUrl}|${boardId}|${guestId}|${authKey}|r${reconnectNonce}`;

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

          if (s === 'connected') {
            hasEverConnectedRef.current = true;
            reconnectAttemptRef.current = 0;
            setIsReconnecting(false);
            setErrorText(undefined);
            setNoticeText(undefined);
            if (noticeTimerRef.current) {
              window.clearTimeout(noticeTimerRef.current);
              noticeTimerRef.current = null;
            }
            return;
          }

          if (s === 'error') {
            setErrorText(err);
            return;
          }

          // For 'closed' / 'connecting' we keep the last fatal error cleared.
          if (s === 'closed') setErrorText(undefined);
        },
        onJoined: (msg) => {
          setRole(msg.role);
          setUsers(msg.users ?? []);
          setPresenceByUserId({});
          if (msg.snapshot) resetBoardRef.current(msg.snapshot);
        },
        onOp: (msg) => {
          if (msg.op) applyRemoteEventRef.current(msg.op);
        },
        onPresence: (msg) => {
          setUsers(msg.users ?? []);
          setPresenceByUserId({});
        },
        onErrorMsg: (msg) => {
          const err = `${msg.code}: ${msg.message}`;

          // Fatal errors should break the connection (CollabClient will close).
          if (msg.fatal) {
            console.error('Collab server fatal error:', err, msg);
            setErrorText(err);
            return;
          }

          // Soft errors: keep the connection alive and show a short-lived notice.
          // Avoid spamming the console with noisy expected errors.
          if (msg.code === 'rate_limited') {
            // Back off a bit to avoid join storms.
            setCooldownUntil(Date.now() + 15_000);
          }

          setNoticeText(msg.message || err);
          if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
          noticeTimerRef.current = window.setTimeout(() => setNoticeText(undefined), 6_000) as any;
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
  }, [enabled, baseUrl, auth, boardId, boardMetaId, guestId, cooldownUntil, boardEnsured, reconnectNonce]);


  // Auto-reconnect (best-effort). We only do this after we have successfully
  // connected at least once; that prevents loops when credentials are wrong.
  useEffect(() => {
    if (!enabled) return;

    const now = Date.now();
    if (cooldownUntil && now < cooldownUntil) return;

    const shouldReconnect =
      status === 'closed' || (status === 'error' && hasEverConnectedRef.current);

    if (!shouldReconnect) return;

    // If a reconnect is already scheduled, don't schedule another.
    if (reconnectTimerRef.current) return;

    setIsReconnecting(true);

    const attempt = reconnectAttemptRef.current + 1;
    reconnectAttemptRef.current = attempt;

    const baseDelay = 750;
    const maxDelay = 15_000;
    const backoff = Math.min(maxDelay, baseDelay * Math.pow(2, attempt - 1));
    const jitter = Math.floor(backoff * (0.2 * Math.random()));
    const delay = backoff + jitter;

    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      setReconnectNonce((n) => n + 1);
    }, delay) as any;

    return () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [enabled, status, cooldownUntil]);

  const sendOp = (event: BoardEvent) => {
    if (!enabled || status !== 'connected' || !boardId) return;
    clientRef.current?.sendOp(event, boardId);
  };

// Throttle presence to avoid spamming the server (and to play nicely with server-side rate limits).
const PRESENCE_THROTTLE_MS = 120;
const pendingPresenceRef = useRef<PresencePayload | null>(null);
const presenceTimerRef = useRef<number | null>(null);
const lastPresenceSentAtRef = useRef<number>(0);

const flushPresence = () => {
  presenceTimerRef.current = null;
  if (!enabled || status !== 'connected' || !boardId) return;

  const pending = pendingPresenceRef.current;
  if (!pending) return;

  const now = Date.now();
  const elapsed = now - lastPresenceSentAtRef.current;
  if (elapsed < PRESENCE_THROTTLE_MS) {
    presenceTimerRef.current = window.setTimeout(flushPresence, PRESENCE_THROTTLE_MS - elapsed) as any;
    return;
  }

  pendingPresenceRef.current = null;
  lastPresenceSentAtRef.current = now;
  clientRef.current?.sendPresence(boardId, pending);

  // If something arrived while we sent (rare), schedule another tick.
  if (pendingPresenceRef.current && !presenceTimerRef.current) {
    presenceTimerRef.current = window.setTimeout(flushPresence, PRESENCE_THROTTLE_MS) as any;
  }
};

const sendPresence = (presence: PresencePayload) => {
  if (!enabled || status !== 'connected' || !boardId) return;

  // Merge presence updates (latest wins).
  pendingPresenceRef.current = { ...(pendingPresenceRef.current ?? {}), ...(presence ?? {}) };

  if (!presenceTimerRef.current) {
    presenceTimerRef.current = window.setTimeout(flushPresence, PRESENCE_THROTTLE_MS) as any;
  }
};


  return {
    enabled,
    status,
    errorText,
    noticeText,
    isReconnecting,
    hasEverConnected: hasEverConnectedRef.current,
    role,
    users,
    presenceByUserId,
    inviteToken: inviteToken ?? undefined,
    guestId,
    selfUserId,
    sendOp,
    sendPresence,
  };
}