import { useEffect, useRef, type MutableRefObject, type Dispatch, type SetStateAction } from 'react';
import type { BoardEvent } from '../../../domain/types';
import type { BoardRole, PresencePayload, PresenceUser } from '../../../collab/protocol';
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

const PRESENCE_STALE_TTLS = {
  cursor: 15_000,
  viewport: 45_000,
  selection: 20_000,
  typing: 6_000,
};

type PresenceActivityMeta = {
  cursorAt?: number;
  viewportAt?: number;
  selectionAt?: number;
  typingAt?: number;
};

type PresencePayloadWithMeta = PresencePayload & {
  __activity?: PresenceActivityMeta;
};

function readActivityMeta(payload: PresencePayload | undefined): PresenceActivityMeta {
  const meta = (payload as PresencePayloadWithMeta | undefined)?.__activity;
  return meta && typeof meta === 'object' ? meta : {};
}

function applyActivityMeta(payload: PresencePayload, patch: PresenceActivityMeta): PresencePayload {
  const existing = readActivityMeta(payload);
  return {
    ...(payload as PresencePayloadWithMeta),
    __activity: { ...existing, ...patch },
  } as PresencePayload;
}

function cleanupPresencePayload(payload: PresencePayload, now: number): PresencePayload | null {
  const next: PresencePayloadWithMeta = { ...(payload as PresencePayloadWithMeta) };
  const meta = readActivityMeta(payload);
  if (meta.cursorAt && now - meta.cursorAt > PRESENCE_STALE_TTLS.cursor) {
    delete next.cursor;
  }
  if (meta.viewportAt && now - meta.viewportAt > PRESENCE_STALE_TTLS.viewport) {
    delete next.viewport;
  }
  if (meta.selectionAt && now - meta.selectionAt > PRESENCE_STALE_TTLS.selection) {
    delete next.selectionIds;
  }
  if (meta.typingAt && now - meta.typingAt > PRESENCE_STALE_TTLS.typing) {
    delete next.isTyping;
  }
  const nextMeta: PresenceActivityMeta = {};
  if (next.cursor) nextMeta.cursorAt = meta.cursorAt;
  if (next.viewport) nextMeta.viewportAt = meta.viewportAt;
  if (next.selectionIds?.length) nextMeta.selectionAt = meta.selectionAt;
  if (next.isTyping) nextMeta.typingAt = meta.typingAt;
  if (Object.keys(nextMeta).length) next.__activity = nextMeta;
  else delete next.__activity;
  if (!next.cursor && !next.viewport && !(next.selectionIds?.length) && !next.isTyping) return null;
  return next as PresencePayload;
}

function cleanupPresenceMap(current: Record<string, PresencePayload>, activeUserIds: Set<string>, now: number) {
  const next: Record<string, PresencePayload> = {};
  for (const [userId, payload] of Object.entries(current)) {
    if (!activeUserIds.has(userId)) continue;
    const cleaned = cleanupPresencePayload(payload, now);
    if (cleaned) next[userId] = cleaned;
  }
  return next;
}

function mergeEphemeralPresence(
  current: Record<string, PresencePayload>,
  msg: WsEphemeralMessage
): Record<string, PresencePayload> {
  const payload = asRecord(msg.payload);
  if (!payload || !msg.from) return current;

  const existing = current[msg.from] ?? {};
  const now = Date.now();
  switch (msg.eventType) {
    case 'cursor': {
      const x = toNumber(payload.x);
      const y = toNumber(payload.y);
      if (x === null || y === null) return current;
      return { ...current, [msg.from]: applyActivityMeta({ ...existing, cursor: { x, y } }, { cursorAt: now }) };
    }
    case 'viewport': {
      const panX = toNumber(payload.panX);
      const panY = toNumber(payload.panY);
      const zoom = toNumber(payload.zoom);
      if (panX === null || panY === null || zoom === null) return current;
      return { ...current, [msg.from]: applyActivityMeta({ ...existing, viewport: { panX, panY, zoom } }, { viewportAt: now }) };
    }
    case 'presence-meta': {
      const hasSelectionIds = Array.isArray(payload.selectionIds);
      const selectionIds = hasSelectionIds ? toStringArray(payload.selectionIds) ?? [] : undefined;
      const next = {
        ...existing,
        ...(hasSelectionIds ? { selectionIds } : {}),
        ...(typeof payload.isTyping === 'boolean' ? { isTyping: payload.isTyping } : {}),
      };
      return {
        ...current,
        [msg.from]: applyActivityMeta(next, {
          ...(hasSelectionIds ? { selectionAt: now } : {}),
          ...(typeof payload.isTyping === 'boolean' && payload.isTyping ? { typingAt: now } : {}),
        }),
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
  const bootstrapSnapshotOnJoinRef = useRef(bootstrapSnapshotOnJoin);
  const handleEphemeralMessageRef = useRef(handleEphemeralMessage);
  const clearFatalErrorRef = useRef(clearFatalError);
  const setFatalErrorRef = useRef(setFatalError);
  const clearAllNoticesRef = useRef(clearAllNotices);
  const showSoftErrorRef = useRef(showSoftError);
  const usersRef = useRef<PresenceUser[]>([]);

  useEffect(() => {
    applyRemoteEventRef.current = applyRemoteEvent;
  }, [applyRemoteEvent]);

  useEffect(() => {
    bootstrapSnapshotOnJoinRef.current = bootstrapSnapshotOnJoin;
  }, [bootstrapSnapshotOnJoin]);

  useEffect(() => {
    handleEphemeralMessageRef.current = handleEphemeralMessage;
  }, [handleEphemeralMessage]);

  useEffect(() => {
    clearFatalErrorRef.current = clearFatalError;
  }, [clearFatalError]);

  useEffect(() => {
    setFatalErrorRef.current = setFatalError;
  }, [setFatalError]);

  useEffect(() => {
    clearAllNoticesRef.current = clearAllNotices;
  }, [clearAllNotices]);

  useEffect(() => {
    showSoftErrorRef.current = showSoftError;
  }, [showSoftError]);

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = window.setInterval(() => {
      const activeUserIds = new Set(usersRef.current.map((user) => user.userId));
      setPresenceByUserId((current) => cleanupPresenceMap(current, activeUserIds, Date.now()));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [enabled, setPresenceByUserId]);

  useEffect(() => {
    if (!enabled || !wsBaseUrl || !boardId || (!accessToken && !inviteToken)) {
      clientRef.current?.close();
      clientRef.current = null;
      clientKeyRef.current = null;
      usersRef.current = [];
      setUsers([]);
      setPresenceByUserId({});
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
      setFatalErrorRef.current('Too many join attempts; cooling down…');
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
            clearAllNoticesRef.current();
            return;
          }

          if (s === 'error') {
            setFatalErrorRef.current(err);
            return;
          }

          if (s === 'closed') clearFatalErrorRef.current();
        },
        onJoined: (msg) => {
          setSelfUserId(msg.userId);
          const joinedState = createJoinedPresenceState(msg);
          setRole(joinedState.role);
          usersRef.current = joinedState.users;
          setUsers(joinedState.users);
          setPresenceByUserId(joinedState.presenceByUserId);
          bootstrapSnapshotOnJoinRef.current(msg);
        },
        onOp: (msg) => {
          if (msg.op) applyRemoteEventRef.current(msg.op);
        },
        onPresence: (msg) => {
          const presenceState = createPresenceMessageState(msg);
          usersRef.current = presenceState.users;
          setUsers(presenceState.users);
          setPresenceByUserId(cleanupPresenceMap(presenceState.presenceByUserId, new Set(presenceState.users.map((user) => user.userId)), Date.now()));
        },
        onEphemeral: (msg) => {
          handleEphemeralMessageRef.current(msg);
          setPresenceByUserId((current) => mergeEphemeralPresence(current, msg));
        },
        onErrorMsg: (msg) => {
          const err = `${msg.code}: ${msg.message}`;
          if (msg.fatal) {
            console.error('Collab server fatal error:', err, msg);
            setFatalErrorRef.current(err);
            return;
          }
          showSoftErrorRef.current({
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
    setStatus,
    setSelfUserId,
    setRole,
    setUsers,
    setPresenceByUserId,
    clientRef,
  ]);
}
