import { useEffect, useMemo, useRef, useState } from 'react';
import type { BoardEvent, WhiteboardState } from '../../domain/types';
import type { BoardRole, PresencePayload, PresenceUser } from '../../../shared/protocol';
import { CollabClient, type CollabStatus } from '../../collab/CollabClient';
import { useAuth } from '../../auth/AuthContext';
import { getApiBaseUrl, getWsBaseUrl } from '../../config/server';
import { deriveSelfUserId, getInviteTokenFromUrl, getOrCreateGuestId } from './collab/collabIdentity';
import { decodeSnapshotJson } from '../../domain/snapshotCodec';
import { loadLatestSnapshotOrNull, useSnapshotAutosave } from './collab/useSnapshotSync';
import { usePresenceSender } from './collab/usePresenceSender';
import { useAutoReconnect } from './collab/useAutoReconnect';

export type UseBoardCollaborationArgs = {
  boardId: string | undefined;
  /** Current local board state (used for snapshot autosave). */
  state?: WhiteboardState | null;
  boardMetaId?: string;
  boardName?: string;// reserved for future use
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

function normalizeQueryToken(t: string | null | undefined, key: string): string | null {
    const s = (t ?? '').trim();
    if (!s) return null;
    const idx = s.lastIndexOf(`${key}=`);
    if (idx >= 0) return s.substring(idx + key.length + 1).replace(/^[?&]/, '').trim();
    return s.replace(/^[?&]/, '').trim();
}


export function useBoardCollaboration({
  boardId,
  state,
  boardMetaId,
  resetBoard,
  applyRemoteEvent,
}: UseBoardCollaborationArgs): UseBoardCollaborationResult {
  const apiBaseUrl = getApiBaseUrl();
  const wsBaseUrl = getWsBaseUrl();

  const auth = useAuth();
  const rawAccessToken = auth.accessToken;
  const accessToken = normalizeQueryToken(rawAccessToken, 'access_token') ?? rawAccessToken;
  const user = auth.user;
  const isAuthenticated = Boolean(accessToken);

  const inviteParam = useMemo(() => normalizeQueryToken(getInviteTokenFromUrl(), 'invite'), []);
  const inviteToken = useMemo(() => (isAuthenticated ? null : inviteParam), [inviteParam, isAuthenticated]);

  const guestId = useMemo(() => getOrCreateGuestId(), []);
  const displayName = isAuthenticated
    ? user?.name ?? user?.preferred_username ?? user?.email ?? 'User'
    : 'Guest';

  const [selfUserId, setSelfUserId] = useState<string>(guestId);

  const [status, setStatus] = useState<CollabStatus | 'disabled'>('disabled');
  const [errorText, setErrorText] = useState<string | undefined>(undefined);
  const [noticeText, setNoticeText] = useState<string | undefined>(undefined);
  const noticeTimerRef = useRef<number | null>(null);

  const [reconnectNonce, setReconnectNonce] = useState(0);
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
  const [boardEnsured, setBoardEnsured] = useState<boolean>(false);

  // Auth is provided by OIDC when signed in.
  // For invite links, the server also allows anonymous WS join when `invite` is provided on the WS URL.
  // In that mode we keep a stable guestId as the local identity.
  useEffect(() => {
    if (inviteToken || !accessToken) {
      setSelfUserId(guestId);
      return;
    }
    setSelfUserId(deriveSelfUserId(guestId, accessToken));
  }, [inviteToken, guestId, accessToken]);

  // Collaboration requires an authenticated access token.
  const wsEnabled = Boolean(apiBaseUrl) && Boolean(wsBaseUrl) && Boolean(boardId) && (Boolean(accessToken) || Boolean(inviteToken));
  const restEnabled = Boolean(apiBaseUrl) && Boolean(boardId) && Boolean(accessToken);
  const enabled = wsEnabled;

  // ---- Snapshot autosave (REST) ----
  useSnapshotAutosave({
    enabled: restEnabled,
    status,
    role,
    boardId,
    baseUrl: apiBaseUrl!,
    accessToken,
    state,
  });

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
    // If we have an invite token, we are allowed to attempt a WS join even without an access token.
    setBoardEnsured(Boolean(accessToken) || Boolean(inviteToken));
  }, [boardId, accessToken, inviteToken]);

  // Clear cooldown when it expires.
  useEffect(() => {
    if (!cooldownUntil) return;
    const now = Date.now();
    if (cooldownUntil <= now) return;
    const t = window.setTimeout(() => setCooldownUntil(0), cooldownUntil - now);
    return () => window.clearTimeout(t);
  }, [cooldownUntil]);

  // WebSocket connection lifecycle.
  useEffect(() => {
    if (!enabled || !wsBaseUrl || !boardId || (!accessToken && !inviteToken)) {
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

    const authKey = accessToken ? `token:${accessToken}` : `invite:${inviteToken}`;
    const key = `${wsBaseUrl}|${boardId}|${guestId}|${authKey}|r${reconnectNonce}`;

    if (clientRef.current && clientKeyRef.current === key) return;

    clientRef.current?.close();
    clientRef.current = null;

    const client = new CollabClient(
      {
        // IMPORTANT: WebSocket base URL is NOT under /api (REST base).
        // Use the derived/configured WS base here so we connect to /ws/boards/...
        baseUrl: wsBaseUrl,
        boardId,
        accessToken,
        inviteToken,
        guestId,
        displayName,
      },
      {
        onStatus: (s, err) => {
          setStatus(s);

          if (s === 'connected') {
            hasEverConnectedRef.current = true;
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
          setUsers(
            msg.users ??
              (msg.presentUserIds ?? []).map((userId) => ({
                userId,
                displayName: userId,
                role: 'viewer' as const,
              }))
          );
          setPresenceByUserId({});


          // If the server provided a snapshot in the WS joined message (used for anonymous invite joins),
          // apply it immediately.
          try {
            const snap = (msg.latestSnapshot ?? msg.snapshot) as any;
            if (snap && !accessToken) {
              // Server sends JSON object; our decoder expects a JSON string.
                            const decoded = decodeSnapshotJson(boardId, JSON.stringify(snap));
              if (decoded) resetBoardRef.current(decoded);
            }
          } catch {
            // ignore
          }

          // Load the latest snapshot via REST on join (source of truth) when authenticated.

          (async () => {
            try {
              if (!apiBaseUrl || !boardId || !accessToken) return;
              const decoded = await loadLatestSnapshotOrNull({ baseUrl: apiBaseUrl, accessToken, boardId });
              if (decoded) resetBoardRef.current(decoded);
            } catch {
              // Best-effort: if snapshots fail, keep whatever local state we have.
            }
          })();
        },
        onOp: (msg) => {
          if (msg.op) applyRemoteEventRef.current(msg.op);
        },
        onPresence: (msg) => {
          setUsers(
            msg.users ??
              (msg.presentUserIds ?? []).map((userId) => ({
                userId,
                displayName: userId,
                role: 'viewer' as const,
              }))
          );
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
  }, [
    enabled,
    apiBaseUrl,
    wsBaseUrl,
    accessToken,
    boardId,
    boardMetaId,
    guestId,
    cooldownUntil,
    boardEnsured,
    reconnectNonce,
  ]);

  // Auto-reconnect (best-effort).
  useAutoReconnect({
    enabled,
    status,
    cooldownUntil,
    hasEverConnectedRef,
    setIsReconnecting,
    setReconnectNonce,
  });

  const { sendOp, sendPresence } = usePresenceSender({
    enabled,
    status,
    boardId,
    clientRef,
  });

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