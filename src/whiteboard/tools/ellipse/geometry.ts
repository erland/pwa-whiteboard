// src/whiteboard/tools/ellipse/geometry.ts

import type { WhiteboardObject } from '../../../domain/types';
import type { Bounds } from '../../geometry/types';

export function getEllipseBoundingBox(obj: WhiteboardObject): Bounds | null {
  if (obj.type !== 'ellipse') return null;
  if (typeof obj.x !== 'number' || typeof obj.y !== 'number') return null;
  return {
    x: obj.x,
    y: obj.y,
    width: obj.width ?? 0,
    height: obj.height ?? 0
  };
}
