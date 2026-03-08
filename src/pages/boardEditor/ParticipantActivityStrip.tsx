import React from 'react';
import type { PresencePayload, PresenceUser } from '../../../shared/protocol';

type ParticipantActivityStripProps = {
  users: PresenceUser[];
  presenceByUserId: Record<string, PresencePayload>;
  selfUserId: string;
};

export const ParticipantActivityStrip: React.FC<ParticipantActivityStripProps> = ({
  users,
  presenceByUserId,
  selfUserId,
}) => {
  const remoteUsers = users.filter((user) => user.userId !== selfUserId);
  if (!remoteUsers.length) return null;

  return (
    <div className="participant-activity-strip" role="status" aria-live="polite">
      {remoteUsers.map((user) => {
        const presence = presenceByUserId[user.userId];
        const selectionCount = presence?.selectionIds?.length ?? 0;
        const isViewing = Boolean(presence?.viewport);
        const isTyping = Boolean(presence?.isTyping);
        return (
          <div key={user.userId} className="participant-activity-chip" title={user.displayName || user.userId}>
            <span className="participant-activity-dot" style={{ background: user.color || undefined }} />
            <span className="participant-activity-name">{user.displayName || user.userId}</span>
            {selectionCount > 0 && <span className="participant-activity-meta">selecting {selectionCount}</span>}
            {isViewing && <span className="participant-activity-meta">viewing</span>}
            {isTyping && <span className="participant-activity-meta">typing</span>}
          </div>
        );
      })}
    </div>
  );
};
