// src/whiteboard/tools/diamond/geometry.ts
import type { WhiteboardObject, Point } from '../../../domain/types';
import type { Bounds } from '../../geometry/types';
import { getBoxBoundingBox, getBoxPorts } from '../_shared/boxGeometry';

/**
 * Bounding box for diamond is the same as its declared (x,y,w,h).
 */
export function getDiamondBoundingBox(obj: WhiteboardObject): Bounds | null {
  return getBoxBoundingBox(obj, 'diamond');
}

export function getDiamondPorts(
  obj: WhiteboardObject
): Array<{ portId: string; point: Point }> {
  // Ports are the midpoints of each side of the bounding box (same as box ports).
  return getBoxPorts(obj, 'diamond');
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
