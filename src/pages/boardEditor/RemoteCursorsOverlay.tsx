import React from 'react';
import type { PresencePayload, PresenceUser } from '../../../shared/protocol';
import type { Viewport } from '../../domain/types';
import { worldToCanvas } from '../../whiteboard/geometry';

type RemoteCursorsOverlayProps = {
  width: number;
  height: number;
  viewport: Viewport;
  users: PresenceUser[];
  presenceByUserId: Record<string, PresencePayload>;
};

export const RemoteCursorsOverlay: React.FC<RemoteCursorsOverlayProps> = ({
  width,
  height,
  viewport,
  users,
  presenceByUserId,
}) => {
  return (
    <div className="remote-cursors-overlay" style={{ width, height }}>
      {users.map((u) => {
        const userId = u.userId;
        const presence = presenceByUserId[userId];
        const cursor = presence?.cursor;
        if (!cursor) return null;

        const p = worldToCanvas(cursor.x, cursor.y, viewport);
        // Clamp to overlay bounds
        const x = Math.max(0, Math.min(width, p.x));
        const y = Math.max(0, Math.min(height, p.y));

        return (
          <div
            key={u.userId}
            className="remote-cursor"
            style={{
              left: x,
              top: y,
              borderColor: u.color ?? undefined,
            }}
            title={u.displayName ?? u.userId}
          >
            <div className="remote-cursor-dot" style={{ background: u.color ?? undefined }} />
            <div className="remote-cursor-label" style={{ background: u.color ?? undefined }}>
              {u.displayName ?? 'Guest'}
            </div>
          </div>
        );
      })}
    </div>
  );
};
