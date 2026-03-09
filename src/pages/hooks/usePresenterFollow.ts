import { useEffect, useMemo, useState } from 'react';
import type { PresencePayload, PresenceUser } from '../../../shared/protocol';
import type { WsEphemeralMessage } from '../../api/javaWhiteboardServerContract';
import type { Viewport } from '../../domain/types';

type Args = {
  enabled: boolean;
  selfUserId: string;
  users: PresenceUser[];
  presenceByUserId: Record<string, PresencePayload>;
  lastEphemeralMessage: WsEphemeralMessage | null;
  sendEphemeral: (eventType: WsEphemeralMessage['eventType'], payload: Record<string, unknown>) => boolean;
  applyViewport: (viewport: Viewport) => void;
};

function readFollowPayload(payload: unknown): { presenterUserId: string | null; active: boolean } | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const presenterUserId = typeof record.presenterUserId === 'string'
    ? record.presenterUserId.trim()
    : typeof record.targetUserId === 'string'
      ? record.targetUserId.trim()
      : '';
  const active = typeof record.active === 'boolean'
    ? record.active
    : typeof record.action === 'string'
      ? record.action.trim().toLowerCase() !== 'stop'
      : Boolean(presenterUserId);
  return { presenterUserId: presenterUserId || null, active };
}

export function usePresenterFollow({
  enabled,
  selfUserId,
  users,
  presenceByUserId,
  lastEphemeralMessage,
  sendEphemeral,
  applyViewport,
}: Args) {
  const [presenterUserId, setPresenterUserId] = useState<string | null>(null);
  const [followingUserId, setFollowingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setPresenterUserId(null);
      setFollowingUserId(null);
    }
  }, [enabled]);

  useEffect(() => {
    if (!lastEphemeralMessage || lastEphemeralMessage.eventType !== 'follow') return;
    const parsed = readFollowPayload(lastEphemeralMessage.payload);
    if (!parsed) return;
    if (!parsed.active || !parsed.presenterUserId) {
      setPresenterUserId((current) => (current === lastEphemeralMessage.from ? null : current));
      setFollowingUserId((current) => (current === lastEphemeralMessage.from ? null : current));
      return;
    }
    setPresenterUserId(parsed.presenterUserId);
  }, [lastEphemeralMessage]);

  const presenter = useMemo(
    () => users.find((user) => user.userId === presenterUserId) ?? null,
    [presenterUserId, users]
  );

  useEffect(() => {
    if (!followingUserId) return;
    const viewportPresence = presenceByUserId[followingUserId]?.viewport;
    if (!viewportPresence) return;
    applyViewport({
      offsetX: viewportPresence.panX,
      offsetY: viewportPresence.panY,
      zoom: viewportPresence.zoom,
    });
  }, [applyViewport, followingUserId, presenceByUserId]);

  useEffect(() => {
    if (!followingUserId) return;
    if (!users.some((user) => user.userId === followingUserId)) {
      setFollowingUserId(null);
    }
  }, [followingUserId, users]);

  const startPresenting = () => {
    if (!enabled || !selfUserId) return false;
    const ok = sendEphemeral('follow', { presenterUserId: selfUserId, active: true, action: 'start' });
    if (ok) setPresenterUserId(selfUserId);
    return ok;
  };

  const stopPresenting = () => {
    if (!enabled || !selfUserId) return false;
    const ok = sendEphemeral('follow', { presenterUserId: selfUserId, active: false, action: 'stop' });
    if (ok) {
      setPresenterUserId((current) => (current === selfUserId ? null : current));
      setFollowingUserId((current) => (current === selfUserId ? null : current));
    }
    return ok;
  };

  const followUser = (userId: string | null) => {
    setFollowingUserId(userId);
  };

  const stopFollowing = () => {
    setFollowingUserId(null);
  };

  return {
    presenterUserId,
    presenter,
    isPresenting: presenterUserId === selfUserId,
    followingUserId,
    isFollowingPresenter: Boolean(followingUserId && presenterUserId && followingUserId === presenterUserId),
    startPresenting,
    stopPresenting,
    followUser,
    stopFollowing,
  };
}
