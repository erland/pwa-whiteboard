import { useEffect, useRef, type MutableRefObject, type Dispatch, type SetStateAction } from 'react';
import type { BoardEvent } from '../../../domain/types';
import type { BoardRole, PresencePayload, PresenceUser } from '../../../../shared/protocol';
import type { WsEphemeralMessage } from '../../../api/javaWhiteboardServerContract';
import {
  createJoinedPresenceState,
  createPresenceMessageState,
} from './collabPresence';
import { CollabClient, type CollabStatus } from '../../../collab/CollabClient';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : undefined;
}

function mergeEphemeralPresence(
  current: Record<string, PresencePayload>,
  msg: WsEphemeralMessage
): Record<string, PresencePayload> {
  const payload = asRecord(msg.payload);
  if (!payload || !msg.from) return current;

  const existing = current[msg.from] ?? {};
  switch (msg.eventType) {
    case 'cursor': {
      const x = toNumber(payload.x);
      const y = toNumber(payload.y);
      if (x === null || y === null) return current;
      return { ...current, [msg.from]: { ...existing, cursor: { x, y } } };
    }
    case 'viewport': {
      const panX = toNumber(payload.panX);
      const panY = toNumber(payload.panY);
      const zoom = toNumber(payload.zoom);
      if (panX === null || panY === null || zoom === null) return current;
      return { ...current, [msg.from]: { ...existing, viewport: { panX, panY, zoom } } };
    }
    case 'presence-meta': {
      return {
        ...current,
        [msg.from]: {
          ...existing,
          ...(toStringArray(payload.selectionIds) ? { selectionIds: toStringArray(payload.selectionIds) } : {}),
          ...(typeof payload.isTyping === 'boolean' ? { isTyping: payload.isTyping } : {}),
        },
      };
    }
    default:
      return current;
  }
}


export type CollabConnectionLifecycleArgs = {
  enabled: boolean;
  boardId?: string;
  boardMetaId?: string;
  boardEnsured: boolean;
  wsBaseUrl?: string;
  accessToken?: string | null;
  inviteToken?: string | null;
  guestId: string;
  displayName?: string;
  authKey: string;
  cooldownUntil: number;
  reconnectNonce: number;
  applyRemoteEvent: (event: BoardEvent) => void;
  bootstrapSnapshotOnJoin: (msg: any) => void;
  setStatus: Dispatch<SetStateAction<CollabStatus | 'disabled'>>;
  setSelfUserId: Dispatch<SetStateAction<string>>;
  setRole: Dispatch<SetStateAction<BoardRole | undefined>>;
  setUsers: Dispatch<SetStateAction<PresenceUser[]>>;
  setPresenceByUserId: Dispatch<SetStateAction<Record<string, PresencePayload>>>;
  handleEphemeralMessage: (msg: WsEphemeralMessage) => void;
  clearFatalError: () => void;
  setFatalError: (error?: string) => void;
  clearAllNotices: () => void;
  showSoftError: (args: { code: string; message: string; cooldownMs?: number }) => void;
  clientRef: MutableRefObject<CollabClient | null>;
};

export function useCollabConnectionLifecycle({
  enabled,
  boardId,
  boardMetaId,
  boardEnsured,
  wsBaseUrl,
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
  handleEphemeralMessage,
  clearFatalError,
  setFatalError,
  clearAllNotices,
  showSoftError,
  clientRef,
}: CollabConnectionLifecycleArgs): void {
  const clientKeyRef = useRef<string | null>(null);
  const applyRemoteEventRef = useRef(applyRemoteEvent);

  useEffect(() => {
    applyRemoteEventRef.current = applyRemoteEvent;
  }, [applyRemoteEvent]);

  useEffect(() => {
    if (!enabled || !wsBaseUrl || !boardId || (!accessToken && !inviteToken)) {
      clientRef.current?.close();
      clientRef.current = null;
      clientKeyRef.current = null;
      setStatus(enabled ? 'idle' : 'disabled');
      return;
    }

    if (!boardEnsured) {
      setStatus('connecting');
      return;
    }
    if (boardMetaId && boardMetaId !== boardId) {
      setStatus('connecting');
      return;
    }

    if (cooldownUntil && Date.now() < cooldownUntil) {
      setStatus('error');
      setFatalError('Too many join attempts; cooling down…');
      return;
    }

    const key = `${wsBaseUrl}|${boardId}|${guestId}|${authKey}|r${reconnectNonce}`;
    if (clientRef.current && clientKeyRef.current === key) return;

    clientRef.current?.close();
    clientRef.current = null;

    const client = new CollabClient(
      {
        baseUrl: wsBaseUrl,
        boardId,
        accessToken: accessToken ?? undefined,
        inviteToken: inviteToken ?? undefined,
        guestId,
        displayName,
      },
      {
        onStatus: (s, err) => {
          setStatus(s);

          if (s === 'connected') {
            clearAllNotices();
            return;
          }

          if (s === 'error') {
            setFatalError(err);
            return;
          }

          if (s === 'closed') clearFatalError();
        },
        onJoined: (msg) => {
          setSelfUserId(msg.userId);
          const joinedState = createJoinedPresenceState(msg);
          setRole(joinedState.role);
          setUsers(joinedState.users);
          setPresenceByUserId(joinedState.presenceByUserId);
          bootstrapSnapshotOnJoin(msg);
        },
        onOp: (msg) => {
          if (msg.op) applyRemoteEventRef.current(msg.op);
        },
        onPresence: (msg) => {
          const presenceState = createPresenceMessageState(msg);
          setUsers(presenceState.users);
          setPresenceByUserId(presenceState.presenceByUserId);
        },
        onEphemeral: (msg) => {
          handleEphemeralMessage(msg);
          setPresenceByUserId((current) => mergeEphemeralPresence(current, msg));
        },
        onErrorMsg: (msg) => {
          const err = `${msg.code}: ${msg.message}`;
          if (msg.fatal) {
            console.error('Collab server fatal error:', err, msg);
            setFatalError(err);
            return;
          }
          showSoftError({
            code: msg.code,
            message: msg.message || err,
            cooldownMs: msg.code === 'rate_limited' ? 15_000 : undefined,
          });
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
    wsBaseUrl,
    accessToken,
    inviteToken,
    boardId,
    boardMetaId,
    guestId,
    displayName,
    authKey,
    cooldownUntil,
    boardEnsured,
    reconnectNonce,
    applyRemoteEvent,
    bootstrapSnapshotOnJoin,
    setStatus,
    setSelfUserId,
    setRole,
    setUsers,
    setPresenceByUserId,
  handleEphemeralMessage,
    clearFatalError,
    setFatalError,
    clearAllNotices,
    handleEphemeralMessage,
    showSoftError,
    clientRef,
  ]);
}
