import React from 'react';
import type { ReactionBurst } from '../hooks/useBoardReactions';
import type { PresenceUser } from '../../../shared/protocol';

type ReactionOverlayProps = {
  bursts: ReactionBurst[];
  users: PresenceUser[];
};

export const ReactionOverlay: React.FC<ReactionOverlayProps> = ({ bursts, users }) => {
  if (!bursts.length) return null;
  const displayNameByUserId = new Map(users.map((user) => [user.userId, user.displayName || user.userId]));

  return (
    <div className="reaction-overlay" aria-hidden="true">
      {bursts.map((burst) => (
        <div
          key={burst.id}
          className="reaction-burst"
          style={{ left: burst.x, top: burst.y }}
          title={displayNameByUserId.get(burst.userId) || burst.userId}
        >
          <span className="reaction-burst-emoji">{burst.reactionType}</span>
          <span className="reaction-burst-user">{displayNameByUserId.get(burst.userId) || burst.userId}</span>
        </div>
      ))}
    </div>
  );
};
