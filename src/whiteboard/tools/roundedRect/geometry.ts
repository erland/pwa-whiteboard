// src/whiteboard/tools/roundedRect/geometry.ts

import type { WhiteboardObject, Point } from '../../../domain/types';
import type { Bounds } from '../../geometry/types';
import { getBoxBoundingBox, getBoxPorts } from '../_shared/boxGeometry';

export function getRoundedRectPorts(
  obj: WhiteboardObject
): Array<{ portId: string; point: Point }> {
  return getBoxPorts(obj, 'roundedRect');
}

export function getRoundedRectBoundingBox(obj: WhiteboardObject): Bounds | null {
  return getBoxBoundingBox(obj, 'roundedRect');
}
