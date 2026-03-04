import { useEffect, useMemo, useRef, useState } from 'react';
import type { BoardEvent } from '../../domain/types';
import type { BoardRole, PresencePayload, PresenceUser } from '../../../shared/protocol';
import { CollabClient, type CollabStatus } from '../../collab/CollabClient';
import { useAuth } from '../../auth/AuthContext';
import { getBestLocalBoardTitle } from '../../domain/boardTitle';
import { getWhiteboardServerBaseUrl } from '../../config/server';
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
  const baseUrl = getWhiteboardServerBaseUrl();
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

  const { accessToken } = useAuth();
  const [boardEnsured, setBoardEnsured] = useState<boolean>(false);

  // Auth is provided by OIDC (or invite token).
  useEffect(() => {
    if (inviteToken) {
      setSelfUserId(guestId);
      return;
    }
    // Use OIDC subject when authenticated; otherwise fall back to a stable guest id.
    const next = (accessToken ? ((): string => {
      try {
        const parts = accessToken.split('.');
        if (parts.length >= 2) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
          if (typeof payload.sub === 'string' && payload.sub.length) return payload.sub;
        }
      } catch { /* ignore */ }
      return guestId;
    })() : guestId);
    setSelfUserId(next);
  }, [inviteToken, guestId, accessToken]);

  // Collaboration requires an authenticated access token. Invite tokens are used only
  // to accept the invite via HTTP; after that, join using the access token.
  const enabled = Boolean(baseUrl) && Boolean(boardId) && Boolean(accessToken);

  // Keep status in sync with enabled/disabled transitions.
  useEffect(() => {
    if (!enabled) {
      setStatus('disabled');
    } else {
      // Don't force-reset to idle if we are already connecting/connected.
      setStatus((s) => (s === 'disabled' ? 'idle' : s));
    }
  }, [enabled]);

// Board existence is managed by the server API (Step 4). For now, treat an enabled session as ensured.
  useEffect(() => {
    if (!boardId) {
      setBoardEnsured(false);
      return;
    }
    // Board existence is managed by the server API (Step 4). For now, treat an enabled session as ensured.
    setBoardEnsured(Boolean(accessToken));
  }, [boardId, accessToken]);
  useEffect(() => {
    if (!cooldownUntil) return;
    const now = Date.now();
    if (cooldownUntil <= now) return;
    const t = window.setTimeout(() => setCooldownUntil(0), cooldownUntil - now);
    return () => window.clearTimeout(t);
  }, [cooldownUntil]);

  useEffect(() => {
    if (!enabled || !baseUrl || !accessToken || !boardId) {
      clientRef.current?.close();
      clientRef.current = null;
      clientKeyRef.current = null;
      setStatus(enabled ? 'idle' : 'disabled');
      return;
    }

    // Wait until board metadata is resolved (some routes pass boardMetaId separately).
    if (!boardEnsured) {
      setStatus('connecting');
      return;
    }
    if (boardMetaId && boardMetaId !== boardId) {
      setStatus('connecting');
      return;
    }

    // Cooldown after rate-limit errors (prevents reconnect storms)
    if (cooldownUntil && Date.now() < cooldownUntil) {
      setStatus('error');
      setErrorText('Too many join attempts; cooling down…');
      return;
    }

    const key = `${baseUrl}|${boardId}|${guestId}|token:${accessToken}|r${reconnectNonce}`;

    if (clientRef.current && clientKeyRef.current === key) return;

    clientRef.current?.close();
    clientRef.current = null;

    const client = new CollabClient(
      {
        baseUrl,
        boardId,
        accessToken,
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
          setUsers(msg.users ?? (msg.presentUserIds ?? []).map((userId) => ({ userId, displayName: userId, role: 'viewer' as const })));
          setPresenceByUserId({});
          const snap: any = (msg as any).latestSnapshot ?? msg.snapshot;
          const snapJson = (snap && typeof (snap as any).snapshotJson === 'string') ? (snap as any).snapshotJson : undefined;
          if (snapJson) {
            try {
              resetBoardRef.current(JSON.parse(snapJson));
            } catch {
              // ignore
            }
          } else if (snap) {
            // If server sends the snapshot as an object, accept it as-is.
            resetBoardRef.current(snap);
          }
        },
        onOp: (msg) => {
          if (msg.op) applyRemoteEventRef.current(msg.op);
        },
        onPresence: (msg) => {
          setUsers(msg.users ?? (msg.presentUserIds ?? []).map((userId) => ({ userId, displayName: userId, role: 'viewer' as const })));
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
  }, [enabled, baseUrl, accessToken, boardId, boardMetaId, guestId, cooldownUntil, boardEnsured, reconnectNonce]);


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