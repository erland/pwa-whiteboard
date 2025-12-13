// src/whiteboard/tools/diamond/geometry.ts
import type { WhiteboardObject, Point } from '../../../domain/types';
import type { Bounds } from '../../geometry/types';

/**
 * Bounding box for diamond is the same as its declared (x,y,w,h).
 */
export function getDiamondBoundingBox(obj: WhiteboardObject): Bounds | null {
  if (obj.type !== 'diamond') return null;

  const w = obj.width ?? 0;
  const h = obj.height ?? 0;
  return { x: obj.x, y: obj.y, width: w, height: h };
}

export function getDiamondPorts(
  obj: WhiteboardObject
): Array<{ portId: string; point: Point }> {
  if (obj.type !== 'diamond') return [];

  const w = obj.width ?? 0;
  const h = obj.height ?? 0;

  // If we don't have meaningful dimensions, expose a single anchor port.
  if (w <= 0 || h <= 0) {
    return [{ portId: 'center', point: { x: obj.x, y: obj.y } }];
  }

  const cx = obj.x + w / 2;
  const cy = obj.y + h / 2;

  // Vertices of the diamond (midpoints of each side of the bounding box).
  return [
    { portId: 'center', point: { x: cx, y: cy } },
    { portId: 'top', point: { x: cx, y: obj.y } },
    { portId: 'right', point: { x: obj.x + w, y: cy } },
    { portId: 'bottom', point: { x: cx, y: obj.y + h } },
    { portId: 'left', point: { x: obj.x, y: cy } },
  ];
}

/**
 * Hit-test inside the diamond using the L1-ellipse equation:
 * |dx|/(w/2) + |dy|/(h/2) <= 1
 */
export function hitTestDiamond(
  obj: WhiteboardObject,
  worldX: number,
  worldY: number
): boolean {
  if (obj.type !== 'diamond') return false;

  const w = obj.width ?? 0;
  const h = obj.height ?? 0;
  if (w <= 0 || h <= 0) return false;

  const cx = obj.x + w / 2;
  const cy = obj.y + h / 2;

  const hw = w / 2;
  const hh = h / 2;
  if (hw === 0 || hh === 0) return false;

  const dx = Math.abs(worldX - cx);
  const dy = Math.abs(worldY - cy);

  return dx / hw + dy / hh <= 1;
}
