// src/whiteboard/tools/freehand/geometry.ts

import type { WhiteboardObject } from '../../../domain/types';
import type { Bounds } from '../../geometry/types';

export function getFreehandBoundingBox(obj: WhiteboardObject): Bounds | null {
  if (obj.type !== 'freehand') return null;
  if (typeof obj.x !== 'number' || typeof obj.y !== 'number') return null;

  const width = obj.width ?? 0;
  const height = obj.height ?? 0;

  // Freehand: derive bounds from points if width/height are zero
  if (width === 0 && height === 0 && obj.points && obj.points.length > 1) {
    const xs = obj.points.map((p) => p.x);
    const ys = obj.points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  return {
    x: obj.x,
    y: obj.y,
    width,
    height
  };
}
