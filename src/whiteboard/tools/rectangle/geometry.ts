// src/whiteboard/tools/rectangle/geometry.ts

import type { WhiteboardObject } from '../../../domain/types';
import type { Bounds } from '../../geometry/types';

export function getRectangleBoundingBox(obj: WhiteboardObject): Bounds | null {
  if (obj.type !== 'rectangle') return null;
  if (typeof obj.x !== 'number' || typeof obj.y !== 'number') return null;
  return {
    x: obj.x,
    y: obj.y,
    width: obj.width ?? 0,
    height: obj.height ?? 0
  };
}
