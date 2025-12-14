// src/whiteboard/tools/rectangle/geometry.ts

import type { WhiteboardObject, Point } from '../../../domain/types';
import type { Bounds } from '../../geometry/types';
import { getBoxBoundingBox, getBoxPorts } from '../_shared/boxGeometry';

export function getRectanglePorts(
  obj: WhiteboardObject
): Array<{ portId: string; point: Point }> {
  return getBoxPorts(obj, 'rectangle');
}

export function getRectangleBoundingBox(obj: WhiteboardObject): Bounds | null {
  return getBoxBoundingBox(obj, 'rectangle');
}
