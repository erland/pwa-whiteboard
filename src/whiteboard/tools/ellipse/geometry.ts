// src/whiteboard/tools/ellipse/geometry.ts

import type { WhiteboardObject, Point } from '../../../domain/types';
import type { Bounds } from '../../geometry/types';

export function getEllipsePorts(
  obj: WhiteboardObject
): Array<{ portId: string; point: Point }> {
  if (obj.type !== 'ellipse') return [];

  const w = obj.width ?? 0;
  const h = obj.height ?? 0;

  if (w <= 0 || h <= 0) {
    return [{ portId: 'center', point: { x: obj.x, y: obj.y } }];
  }

  const cx = obj.x + w / 2;
  const cy = obj.y + h / 2;

  // Cardinal ports on the ellipse perimeter (using the bounding box extents).
  return [
    { portId: 'center', point: { x: cx, y: cy } },
    { portId: 'top', point: { x: cx, y: obj.y } },
    { portId: 'right', point: { x: obj.x + w, y: cy } },
    { portId: 'bottom', point: { x: cx, y: obj.y + h } },
    { portId: 'left', point: { x: obj.x, y: cy } }
  ];
}

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
