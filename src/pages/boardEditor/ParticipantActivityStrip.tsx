import React from 'react';
import type { PresencePayload, PresenceUser } from '../../collab/protocol';

type RecentReaction = {
  reactionType: string;
  createdAt: number;
};

type ParticipantActivityStripProps = {
  users: PresenceUser[];
  presenceByUserId: Record<string, PresencePayload>;
  selfUserId: string;
  presenterUserId?: string | null;
  followingUserId?: string | null;
  recentReactionByUserId?: Record<string, RecentReaction>;
  onFollowUser?: (userId: string) => void;
  onStopFollowing?: () => void;
  onStartPresenting?: () => void;
  onStopPresenting?: () => void;
};

export const ParticipantActivityStrip: React.FC<ParticipantActivityStripProps> = ({
  users,
  presenceByUserId,
  selfUserId,
  presenterUserId,
  followingUserId,
  recentReactionByUserId,
  onFollowUser,
  onStopFollowing,
  onStartPresenting,
  onStopPresenting,
}) => {
  const remoteUsers = users.filter((user) => user.userId !== selfUserId);
  const selfUser = users.find((user) => user.userId === selfUserId) ?? null;
  const hasActions = Boolean(onFollowUser || onStartPresenting || onStopPresenting);
  const formatRecent = (createdAt: number | undefined) => {
    if (!createdAt) return '';
    const elapsedSeconds = Math.max(0, Math.round((Date.now() - createdAt) / 1000));
    return elapsedSeconds <= 2 ? 'just now' : `${elapsedSeconds}s ago`;
  };
  if (!remoteUsers.length && !hasActions) return null;

  return (
    <div className="participant-activity-strip" role="status" aria-live="polite">
      {(onStartPresenting || onStopPresenting) && (
        <div className="participant-activity-chip participant-activity-chip--self">
          <span className="participant-activity-dot" style={{ background: selfUser?.color || undefined }} />
          <span className="participant-activity-name">You</span>
          {presenterUserId === selfUserId && <span className="participant-activity-meta">presenting</span>}
          {followingUserId && followingUserId !== selfUserId && (
            <span className="participant-activity-meta">following {users.find((user) => user.userId === followingUserId)?.displayName || 'participant'}</span>
          )}
          {recentReactionByUserId?.[selfUserId] && (
            <span className="participant-activity-meta" title={`Reacted ${formatRecent(recentReactionByUserId[selfUserId]?.createdAt)}`}>
              reacted {recentReactionByUserId[selfUserId]?.reactionType}
            </span>
          )}
          {presenterUserId === selfUserId ? (
            <button type="button" className="participant-activity-action" onClick={onStopPresenting}>
              Stop presenting
            </button>
          ) : (
            <button type="button" className="participant-activity-action" onClick={onStartPresenting}>
              Present
            </button>
          )}
        </div>
      )}
      {remoteUsers.map((user) => {
        const presence = presenceByUserId[user.userId];
        const selectionCount = presence?.selectionIds?.length ?? 0;
        const isViewing = Boolean(presence?.viewport);
        const isTyping = Boolean(presence?.isTyping);
        const isPresenter = presenterUserId === user.userId;
        const isFollowing = followingUserId === user.userId;
        const recentReaction = recentReactionByUserId?.[user.userId] ?? null;
        return (
          <div key={user.userId} className="participant-activity-chip" title={user.displayName || user.userId}>
            <span className="participant-activity-dot" style={{ background: user.color || undefined }} />
            <span className="participant-activity-name">{user.displayName || user.userId}</span>
            {isPresenter && <span className="participant-activity-meta">presenting</span>}
            {selectionCount > 0 && <span className="participant-activity-meta">selecting {selectionCount}</span>}
            {isViewing && <span className="participant-activity-meta">viewing</span>}
            {isTyping && <span className="participant-activity-meta">typing</span>}
            {isFollowing && <span className="participant-activity-meta">followed</span>}
            {recentReaction && (
              <span className="participant-activity-meta participant-activity-meta--reaction" title={`Reacted ${formatRecent(recentReaction.createdAt)}`}>
                reacted {recentReaction.reactionType}
              </span>
            )}
            {onFollowUser && !isFollowing && (
              <button type="button" className="participant-activity-action" onClick={() => onFollowUser(user.userId)}>
                Follow
              </button>
            )}
            {isFollowing && onStopFollowing && (
              <button type="button" className="participant-activity-action" onClick={onStopFollowing}>
                Stop following
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
