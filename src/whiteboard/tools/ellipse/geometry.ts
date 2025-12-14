// src/whiteboard/tools/ellipse/geometry.ts

import type { WhiteboardObject, Point } from '../../../domain/types';
import type { Bounds } from '../../geometry/types';
import { getBoxBoundingBox, getBoxPorts } from '../_shared/boxGeometry';

export function getEllipsePorts(
  obj: WhiteboardObject
): Array<{ portId: string; point: Point }> {
  return getBoxPorts(obj, 'ellipse');
}

export function getEllipseBoundingBox(obj: WhiteboardObject): Bounds | null {
  return getBoxBoundingBox(obj, 'ellipse');
}
