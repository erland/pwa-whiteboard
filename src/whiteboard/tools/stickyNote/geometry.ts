// src/whiteboard/tools/stickyNote/geometry.ts

import type { WhiteboardObject, Point } from '../../../domain/types';
import type { Bounds } from '../../geometry/types';
import { getBoxBoundingBox, getBoxPorts } from '../_shared/boxGeometry';

export function getStickyNotePorts(
  obj: WhiteboardObject
): Array<{ portId: string; point: Point }> {
  return getBoxPorts(obj, 'stickyNote');
}

export function getStickyNoteBoundingBox(obj: WhiteboardObject): Bounds | null {
  return getBoxBoundingBox(obj, 'stickyNote');
}
