// src/whiteboard/tools/text/geometry.ts

import type { WhiteboardObject, Point } from '../../../domain/types';
import type { Bounds } from '../../geometry/types';
import { getBoxBoundingBox, getBoxPorts } from '../_shared/boxGeometry';

export function getTextPorts(
  obj: WhiteboardObject
): Array<{ portId: string; point: Point }> {
  // In v1 the model may or may not set width/height for text.
  // getBoxPorts preserves existing behavior (defaults to single 'center' port when w/h are missing).
  return getBoxPorts(obj, 'text');
}

export function getTextBoundingBox(obj: WhiteboardObject): Bounds | null {
  // In v1 the model may or may not set width/height for text. We keep the
  // existing behavior (defaults to 0) to avoid changing selection/hit-testing.
  return getBoxBoundingBox(obj, 'text');
}
