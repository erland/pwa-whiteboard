import React from 'react';
import type { WhiteboardObject, Viewport } from '../../../domain/types';
import { worldToCanvas, getBoundingBox } from '../../../whiteboard/geometry';

export type ObjectCommentAnchor = {
  objectId: string;
  totalCount: number;
  activeCount: number;
  latestCommentId: string | null;
};

type Props = {
  width: number;
  height: number;
  objects: WhiteboardObject[];
  viewport: Viewport;
  anchors: ObjectCommentAnchor[];
  onOpenObjectComments: (objectId: string) => void;
};

export const ObjectCommentAnchorsOverlay: React.FC<Props> = ({
  width,
  height,
  objects,
  viewport,
  anchors,
  onOpenObjectComments,
}) => {
  const objectMap = React.useMemo(() => {
    const map = new Map<string, WhiteboardObject>();
    for (const object of objects) map.set(object.id, object);
    return map;
  }, [objects]);

  const positionedAnchors = React.useMemo(
    () =>
      anchors
        .map((anchor) => {
          const object = objectMap.get(anchor.objectId);
          if (!object) return null;
          const bounds = getBoundingBox(object, objects);
          if (!bounds) return null;
          const canvasPoint = worldToCanvas(bounds.x + bounds.width, bounds.y, viewport);
          return {
            ...anchor,
            left: Math.min(width - 12, Math.max(12, canvasPoint.x + 8)),
            top: Math.min(height - 12, Math.max(12, canvasPoint.y - 8)),
          };
        })
        .filter((value): value is ObjectCommentAnchor & { left: number; top: number } => Boolean(value)),
    [anchors, height, objectMap, objects, viewport, width]
  );

  if (positionedAnchors.length === 0) return null;

  return (
    <div className="object-comment-anchors-overlay" aria-hidden="false">
      {positionedAnchors.map((anchor) => (
        <button
          key={anchor.objectId}
          type="button"
          className="object-comment-anchor"
          style={{ left: `${anchor.left}px`, top: `${anchor.top}px` }}
          onClick={() => onOpenObjectComments(anchor.objectId)}
          title={
            anchor.activeCount > 0
              ? `${anchor.activeCount} active comment${anchor.activeCount === 1 ? '' : 's'} on this object`
              : `${anchor.totalCount} comment${anchor.totalCount === 1 ? '' : 's'} on this object`
          }
          aria-label={
            anchor.activeCount > 0
              ? `Open ${anchor.activeCount} active comments for object ${anchor.objectId}`
              : `Open ${anchor.totalCount} comments for object ${anchor.objectId}`
          }
        >
          <span className="object-comment-anchor-dot" aria-hidden="true" />
          <span className="object-comment-anchor-count">{anchor.activeCount > 0 ? anchor.activeCount : anchor.totalCount}</span>
        </button>
      ))}
    </div>
  );
};
