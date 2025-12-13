// src/whiteboard/tools/rectangle/geometry.ts

import type { WhiteboardObject, Point } from '../../../domain/types';
import type { Bounds } from '../../geometry/types';

export function getRectanglePorts(
  obj: WhiteboardObject
): Array<{ portId: string; point: Point }> {
  if (obj.type !== 'rectangle') return [];

  const w = obj.width ?? 0;
  const h = obj.height ?? 0;

  // If we don't have meaningful dimensions, expose a single anchor port.
  if (w <= 0 || h <= 0) {
    return [{ portId: 'center', point: { x: obj.x, y: obj.y } }];
  }

  const cx = obj.x + w / 2;
  const cy = obj.y + h / 2;

  return [
    { portId: 'center', point: { x: cx, y: cy } },
    { portId: 'top', point: { x: cx, y: obj.y } },
    { portId: 'right', point: { x: obj.x + w, y: cy } },
    { portId: 'bottom', point: { x: cx, y: obj.y + h } },
    { portId: 'left', point: { x: obj.x, y: cy } }
  ];
}

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
