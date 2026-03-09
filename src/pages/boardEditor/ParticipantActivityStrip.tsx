import React from 'react';
import type { PresencePayload, PresenceUser } from '../../../shared/protocol';

type ParticipantActivityStripProps = {
  users: PresenceUser[];
  presenceByUserId: Record<string, PresencePayload>;
  selfUserId: string;
  presenterUserId?: string | null;
  followingUserId?: string | null;
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
  onFollowUser,
  onStopFollowing,
  onStartPresenting,
  onStopPresenting,
}) => {
  const remoteUsers = users.filter((user) => user.userId !== selfUserId);
  const selfUser = users.find((user) => user.userId === selfUserId) ?? null;
  const hasActions = Boolean(onFollowUser || onStartPresenting || onStopPresenting);
  if (!remoteUsers.length && !hasActions) return null;

  return (
    <div className="participant-activity-strip" role="status" aria-live="polite">
      {(onStartPresenting || onStopPresenting) && (
        <div className="participant-activity-chip participant-activity-chip--self">
          <span className="participant-activity-dot" style={{ background: selfUser?.color || undefined }} />
          <span className="participant-activity-name">You</span>
          {presenterUserId === selfUserId && <span className="participant-activity-meta">presenting</span>}
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
        return (
          <div key={user.userId} className="participant-activity-chip" title={user.displayName || user.userId}>
            <span className="participant-activity-dot" style={{ background: user.color || undefined }} />
            <span className="participant-activity-name">{user.displayName || user.userId}</span>
            {isPresenter && <span className="participant-activity-meta">presenting</span>}
            {selectionCount > 0 && <span className="participant-activity-meta">selecting {selectionCount}</span>}
            {isViewing && <span className="participant-activity-meta">viewing</span>}
            {isTyping && <span className="participant-activity-meta">typing</span>}
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
