import { useEffect, useMemo, useRef, useState } from 'react';
import type { BoardEvent } from '../../domain/types';
import type { BoardRole, PresencePayload, PresenceUser } from '../../../shared/protocol';
import { CollabClient, type CollabStatus } from '../../collab/CollabClient';

function getInviteTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const q = url.searchParams.get('invite');
  if (q) return q;

  // Allow #invite=TOKEN (useful when query params are hard to share)
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const m = /(?:^|&)invite=([^&]+)/.exec(hash);
  if (m?.[1]) return decodeURIComponent(m[1]);
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
  resetBoard: (next: any) => void;
  applyRemoteEvent: (event: BoardEvent) => void;
};

export type UseBoardCollaborationResult = {
  enabled: boolean;
  status: CollabStatus | 'disabled';
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
  resetBoard,
  applyRemoteEvent,
}: UseBoardCollaborationArgs): UseBoardCollaborationResult {
  const baseUrl = (import.meta as any).env?.VITE_COLLAB_BASE_URL as string | undefined;
  const inviteToken = useMemo(() => getInviteTokenFromUrl(), []);
  const guestId = useMemo(() => getOrCreateGuestId(), []);
  const enabled = !!baseUrl && !!inviteToken && !!boardId;

  const [status, setStatus] = useState<CollabStatus | 'disabled'>(enabled ? 'idle' : 'disabled');
  const [role, setRole] = useState<BoardRole | undefined>(undefined);
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, PresencePayload>>({});

  const clientRef = useRef<CollabClient | null>(null);

  useEffect(() => {
    if (!enabled || !baseUrl || !inviteToken || !boardId) {
      setStatus('disabled');
      return;
    }

    const client = new CollabClient(
      {
        baseUrl,
        boardId,
        inviteToken,
        guestId,
        displayName: 'Guest',
      },
      {
        onStatus: (s) => setStatus(s),
        onJoined: (msg) => {
          setRole(msg.role);
          setUsers(msg.users ?? []);
          // Snapshot is authoritative; reset local state to it.
          if (msg.snapshot) {
            resetBoard(msg.snapshot);
          }
        },
        onOp: (msg) => {
          // Server-ordered ops are authoritative.
          applyRemoteEvent(msg.op as BoardEvent);
        },
        onPresence: (msg) => {
          setUsers(msg.users ?? []);
          setPresenceByUserId(msg.presenceByUserId ?? {});
        },
        onErrorMsg: (msg) => {
          // Non-fatal errors can happen; for now just surface status.
          console.error('Collab server error', msg);
        },
      }
    );

    clientRef.current = client;
    client.connect();

    return () => {
      client.close();
      clientRef.current = null;
    };
  }, [enabled, baseUrl, inviteToken, boardId, guestId, resetBoard, applyRemoteEvent]);

  // Presence sending is throttled.
  const lastPresenceRef = useRef<PresencePayload>({});
  const pendingRef = useRef<PresencePayload | null>(null);
  const flushTimerRef = useRef<number | null>(null);

  const flushPresence = () => {
    flushTimerRef.current = null;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending || !boardId) return;
    clientRef.current?.sendPresence(boardId, pending);
    lastPresenceRef.current = pending;
  };

  const sendPresence = (presence: PresencePayload) => {
    if (!enabled || status !== 'connected' || !boardId) return;

    // Merge to allow partial updates.
    const merged: PresencePayload = {
      ...lastPresenceRef.current,
      ...presence,
    };
    pendingRef.current = merged;

    if (flushTimerRef.current == null) {
      flushTimerRef.current = window.setTimeout(flushPresence, 50);
    }
  };

  const sendOp = (event: BoardEvent) => {
    if (!enabled || status !== 'connected' || !boardId) return;
    clientRef.current?.sendOp(event as any, boardId);
  };

  return {
    enabled,
    status,
    role,
    users,
    presenceByUserId,
    inviteToken: inviteToken ?? undefined,
    guestId,
    sendOp,
    sendPresence,
  };
}
