import { useEffect, useMemo, useRef, useState } from 'react';
import type { BoardEvent, WhiteboardState } from '../../domain/types';
import type { BoardRole, PresencePayload, PresenceUser } from '../../../shared/protocol';
import { type CollabStatus } from '../../collab/CollabClient';
import { useAuth } from '../../auth/AuthContext';
import { getApiBaseUrl, getWsBaseUrl } from '../../config/server';
import { getInviteTokenFromUrl, getOrCreateGuestId } from './collab/collabIdentity';
import { useSnapshotOrchestration } from './collab/useSnapshotOrchestration';
import { usePresenceSender } from './collab/usePresenceSender';
import { useAutoReconnect } from './collab/useAutoReconnect';
import { normalizeQueryToken, resolveCollabJoinAuth } from './collab/collabJoinAuth';
import { useCollabConnectionLifecycle } from './collab/useCollabConnectionLifecycle';
import { useCollabNotices } from './collab/useCollabNotices';
import { CollabClient } from '../../collab/CollabClient';

export type UseBoardCollaborationArgs = {
  boardId: string | undefined;
  /** Current local board state (used for snapshot autosave). */
  state?: WhiteboardState | null;
  boardMetaId?: string;
  boardName?: string; // reserved for future use
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
  state,
  boardMetaId,
  resetBoard,
  applyRemoteEvent,
}: UseBoardCollaborationArgs): UseBoardCollaborationResult {
  const apiBaseUrl = getApiBaseUrl();
  const wsBaseUrl = getWsBaseUrl();

  const auth = useAuth();
  const inviteParam = useMemo(() => normalizeQueryToken(getInviteTokenFromUrl(), 'invite'), []);
  const guestId = useMemo(() => getOrCreateGuestId(), []);
  const joinAuth = useMemo(
    () =>
      resolveCollabJoinAuth({
        auth,
        guestId,
        inviteParam,
        boardId,
        apiBaseUrl: apiBaseUrl ?? undefined,
        wsBaseUrl: wsBaseUrl ?? undefined,
      }),
    [auth, guestId, inviteParam, boardId, apiBaseUrl, wsBaseUrl]
  );

  const {
    accessToken,
    inviteToken,
    displayName,
    initialSelfUserId,
    restEnabled,
    enabled,
    boardEnsured,
    authKey,
  } = joinAuth;

  const [selfUserId, setSelfUserId] = useState<string>(initialSelfUserId);
  const [status, setStatus] = useState<CollabStatus | 'disabled'>('disabled');
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const hasEverConnectedRef = useRef(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const [role, setRole] = useState<BoardRole | undefined>(undefined);
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, PresencePayload>>({});
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);

  const clientRef = useRef<CollabClient | null>(null);

  const { errorText, noticeText, setFatalError, clearFatalError, clearAllNotices, showSoftError } =
    useCollabNotices(setCooldownUntil);

  useEffect(() => {
    setSelfUserId(initialSelfUserId);
  }, [initialSelfUserId]);

  const { bootstrapSnapshotOnJoin } = useSnapshotOrchestration({
    enabled: restEnabled,
    status,
    role,
    boardId,
    baseUrl: apiBaseUrl ?? undefined,
    accessToken,
    state,
    resetBoard,
  });

  useEffect(() => {
    if (!enabled) {
      setStatus('disabled');
    } else {
      setStatus((s) => (s === 'disabled' ? 'idle' : s));
    }
  }, [enabled]);

  useEffect(() => {
    if (status === 'connected') {
      hasEverConnectedRef.current = true;
      setIsReconnecting(false);
    }
  }, [status]);

  useEffect(() => {
    if (!cooldownUntil) return;
    const now = Date.now();
    if (cooldownUntil <= now) return;
    const t = window.setTimeout(() => setCooldownUntil(0), cooldownUntil - now);
    return () => window.clearTimeout(t);
  }, [cooldownUntil]);

  useCollabConnectionLifecycle({
    enabled,
    boardId,
    boardMetaId,
    boardEnsured,
    wsBaseUrl: wsBaseUrl ?? undefined,
    accessToken,
    inviteToken,
    guestId,
    displayName,
    authKey,
    cooldownUntil,
    reconnectNonce,
    applyRemoteEvent,
    bootstrapSnapshotOnJoin,
    setStatus,
    setSelfUserId,
    setRole,
    setUsers,
    setPresenceByUserId,
    clearFatalError,
    setFatalError,
    clearAllNotices,
    showSoftError,
    clientRef,
  });

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
