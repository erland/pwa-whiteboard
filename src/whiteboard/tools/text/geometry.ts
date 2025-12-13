// src/whiteboard/tools/text/geometry.ts

import type { WhiteboardObject } from '../../../domain/types';
import type { Bounds } from '../../geometry/types';

export function getTextBoundingBox(obj: WhiteboardObject): Bounds | null {
  if (obj.type !== 'text') return null;
  if (typeof obj.x !== 'number' || typeof obj.y !== 'number') return null;

  // In v1 the model may or may not set width/height for text. We keep the
  // existing behavior (defaults to 0) to avoid changing selection/hit-testing.
  return {
    x: obj.x,
    y: obj.y,
    width: obj.width ?? 0,
    height: obj.height ?? 0
  };
}
