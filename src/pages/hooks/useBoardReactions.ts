import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WsEphemeralMessage } from '../../api/javaWhiteboardServerContract';

export type ReactionBurst = {
  id: string;
  userId: string;
  reactionType: string;
  createdAt: number;
  x: number;
  y: number;
};

const QUICK_REACTIONS = ['👍', '👏', '🎉', '❤️'];
const OVERLAY_WIDTH = 960;
const OVERLAY_HEIGHT = 540;

function normalizeReactionType(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 8) : null;
}

export function useBoardReactions(args: {
  enabled: boolean;
  canReact: boolean;
  selfUserId?: string | null;
  lastEphemeralMessage: WsEphemeralMessage | null;
  sendEphemeral: (eventType: WsEphemeralMessage['eventType'], payload: Record<string, unknown>) => boolean;
}) {
  const { enabled, canReact, selfUserId, lastEphemeralMessage, sendEphemeral } = args;
  const [bursts, setBursts] = useState<ReactionBurst[]>([]);

  useEffect(() => {
    if (!lastEphemeralMessage || lastEphemeralMessage.eventType !== 'reaction') return;
    const payload = lastEphemeralMessage.payload as Record<string, unknown> | null;
    const reactionType = normalizeReactionType(payload?.reactionType);
    if (!reactionType) return;
    const now = Date.now();
    const seed = `${lastEphemeralMessage.from}:${reactionType}:${now}`;
    const hash = Array.from(seed).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const x = 140 + (hash % Math.max(1, OVERLAY_WIDTH - 280));
    const y = 80 + ((hash >> 8) % Math.max(1, OVERLAY_HEIGHT - 160));
    const burst: ReactionBurst = {
      id: `${seed}:${hash}`,
      userId: lastEphemeralMessage.from,
      reactionType,
      createdAt: now,
      x,
      y,
    };
    setBursts((current) => [...current.slice(-7), burst]);
  }, [lastEphemeralMessage]);

  useEffect(() => {
    if (!bursts.length) return;
    const timer = window.setTimeout(() => {
      const cutoff = Date.now() - 2500;
      setBursts((current) => current.filter((item) => item.createdAt >= cutoff));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [bursts]);

  const sendReaction = useCallback(
    (reactionType: string) => {
      if (!enabled || !canReact) return false;
      const normalized = normalizeReactionType(reactionType);
      if (!normalized) return false;
      const sent = sendEphemeral('reaction', { reactionType: normalized, durationMs: 2200 });
      if (sent) {
        setBursts((current) => [
          ...current.slice(-7),
          {
            id: `local:${normalized}:${Date.now()}`,
            userId: selfUserId || 'me',
            reactionType: normalized,
            createdAt: Date.now(),
            x: OVERLAY_WIDTH / 2,
            y: OVERLAY_HEIGHT / 2,
          },
        ]);
      }
      return sent;
    },
    [enabled, canReact, sendEphemeral, selfUserId]
  );

  return {
    quickReactions: QUICK_REACTIONS,
    bursts,
    sendReaction,
    latestReaction: useMemo(() => (bursts.length ? bursts[bursts.length - 1] : null), [bursts]),
  };
}
