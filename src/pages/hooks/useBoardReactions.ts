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

export type RecentReaction = {
  reactionType: string;
  createdAt: number;
};

const QUICK_REACTIONS = ['👍', '👏', '🎉', '❤️'];
const OVERLAY_WIDTH = 960;
const OVERLAY_HEIGHT = 540;
const RECENT_REACTION_TTL_MS = 5000;

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
  const [recentReactionByUserId, setRecentReactionByUserId] = useState<Record<string, RecentReaction>>({});

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
    setRecentReactionByUserId((current) => ({
      ...current,
      [lastEphemeralMessage.from]: { reactionType, createdAt: now },
    }));
  }, [lastEphemeralMessage]);

  useEffect(() => {
    if (!bursts.length && !Object.keys(recentReactionByUserId).length) return;
    const timer = window.setTimeout(() => {
      const now = Date.now();
      const burstCutoff = now - 2500;
      const reactionCutoff = now - RECENT_REACTION_TTL_MS;
      setBursts((current) => current.filter((item) => item.createdAt >= burstCutoff));
      setRecentReactionByUserId((current) => Object.fromEntries(
        Object.entries(current).filter(([, value]) => value.createdAt >= reactionCutoff)
      ));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [bursts, recentReactionByUserId]);

  const sendReaction = useCallback(
    (reactionType: string) => {
      if (!enabled || !canReact) return false;
      const normalized = normalizeReactionType(reactionType);
      if (!normalized) return false;
      const sent = sendEphemeral('reaction', { reactionType: normalized, durationMs: 2200 });
      if (sent) {
        const now = Date.now();
        const localUserId = selfUserId || 'me';
        setBursts((current) => [
          ...current.slice(-7),
          {
            id: `local:${normalized}:${now}`,
            userId: localUserId,
            reactionType: normalized,
            createdAt: now,
            x: OVERLAY_WIDTH / 2,
            y: OVERLAY_HEIGHT / 2,
          },
        ]);
        setRecentReactionByUserId((current) => ({
          ...current,
          [localUserId]: { reactionType: normalized, createdAt: now },
        }));
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
    recentReactionByUserId,
  };
}
