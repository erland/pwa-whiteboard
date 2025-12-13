// src/whiteboard/tools/text/geometry.ts

import type { WhiteboardObject, Point } from '../../../domain/types';
import type { Bounds } from '../../geometry/types';

export function getTextPorts(
  obj: WhiteboardObject
): Array<{ portId: string; point: Point }> {
  if (obj.type !== 'text') return [];

  const w = obj.width ?? 0;
  const h = obj.height ?? 0;

  // If the model doesn't provide width/height, treat text as a single anchor point.
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
