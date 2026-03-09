import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type { PresencePayload } from '../../../collab/protocol';
import type { BoardEvent } from '../../../domain/types';
import type { CollabClient } from '../../../collab/CollabClient';

export type PresenceSenderArgs = {
  enabled: boolean;
  status: 'disabled' | 'idle' | 'connecting' | 'connected' | 'closed' | 'error';
  boardId?: string;
  clientRef: MutableRefObject<CollabClient | null>;
};

/**
 * Throttles presence updates so we don't spam the server.
 */
export function usePresenceSender({ enabled, status, boardId, clientRef }: PresenceSenderArgs): {
  sendPresence: (presence: PresencePayload) => void;
  sendOp: (event: BoardEvent) => void;
} {
  // Throttle presence to avoid spamming the server (and to play nicely with server-side rate limits).
  const PRESENCE_THROTTLE_MS = 120;
  const pendingPresenceRef = useRef<PresencePayload | null>(null);
  const presenceTimerRef = useRef<number | null>(null);
  const lastPresenceSentAtRef = useRef<number>(0);

  const flushPresence = useCallback(() => {
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
  }, [enabled, status, boardId, clientRef]);

  const sendPresence = useCallback(
    (presence: PresencePayload) => {
      if (!enabled || status !== 'connected' || !boardId) return;

      // Merge presence updates (latest wins).
      pendingPresenceRef.current = { ...(pendingPresenceRef.current ?? {}), ...(presence ?? {}) };

      if (!presenceTimerRef.current) {
        presenceTimerRef.current = window.setTimeout(flushPresence, PRESENCE_THROTTLE_MS) as any;
      }
    },
    [enabled, status, boardId, flushPresence]
  );

  const sendOp = useCallback(
    (event: BoardEvent) => {
      if (!enabled || status !== 'connected' || !boardId) return;
      clientRef.current?.sendOp(event, boardId);
    },
    [enabled, status, boardId, clientRef]
  );

  // Cleanup timers on unmount / dependency changes.
  useEffect(() => {
    return () => {
      if (presenceTimerRef.current) {
        window.clearTimeout(presenceTimerRef.current);
        presenceTimerRef.current = null;
      }
    };
  }, []);

  return { sendPresence, sendOp };
}
