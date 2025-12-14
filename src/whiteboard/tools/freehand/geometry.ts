// src/whiteboard/tools/freehand/geometry.ts

import type { WhiteboardObject } from '../../../domain/types';
import type { Bounds } from '../../geometry/types';

export function getFreehandBoundingBox(obj: WhiteboardObject): Bounds | null {
  if (obj.type !== 'freehand') return null;
  if (typeof obj.x !== 'number' || typeof obj.y !== 'number') return null;

  const width = obj.width ?? 0;
  const height = obj.height ?? 0;

  // Freehand: derive bounds from points if width/height are zero
  if (width === 0 && height === 0 && obj.points && obj.points.length > 1) {
    const xs = obj.points.map((p) => p.x);
    const ys = obj.points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  return {
    x: obj.x,
    y: obj.y,
    width,
    height
  };
}

/**
 * Translate a freehand object by dx/dy.
 * - Freehand rendering uses absolute points, so we must shift points as well as x/y.
 */
export function translateFreehandObject(
  obj: WhiteboardObject,
  dx: number,
  dy: number
): Partial<WhiteboardObject> | null {
  if (obj.type !== 'freehand') return null;
  const points = obj.points ? obj.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) : obj.points;
  return {
    x: obj.x + dx,
    y: obj.y + dy,
    points,
  };
}
/**
 * Resize a freehand object to fit new axis-aligned bounds.
 *
 * Strategy:
 * - Treat the current object bounds as the source rectangle.
 * - Scale each point proportionally into the destination rectangle.
 * - Keep x/y/width/height consistent with the new bounds.
 */
export function resizeFreehandObject(
  obj: WhiteboardObject,
  newBounds: Bounds
): Partial<WhiteboardObject> | null {
  if (obj.type !== 'freehand') return null;

  const old = getFreehandBoundingBox(obj);
  if (!old) return null;

  const points = obj.points ?? [];

  // If we have no points, just update the loose bounds.
  if (points.length === 0) {
    return {
      x: newBounds.x,
      y: newBounds.y,
      width: newBounds.width,
      height: newBounds.height,
    };
  }

  const oldW = old.width;
  const oldH = old.height;

  const mapX = (px: number) => {
    if (oldW === 0) {
      // Collapse to the horizontal center of the new bounds.
      return newBounds.x + newBounds.width / 2;
    }
    const t = (px - old.x) / oldW;
    return newBounds.x + t * newBounds.width;
  };

  const mapY = (py: number) => {
    if (oldH === 0) {
      // Collapse to the vertical center of the new bounds.
      return newBounds.y + newBounds.height / 2;
    }
    const t = (py - old.y) / oldH;
    return newBounds.y + t * newBounds.height;
  };

  const nextPoints = points.map((p) => ({ x: mapX(p.x), y: mapY(p.y) }));

  return {
    x: newBounds.x,
    y: newBounds.y,
    width: newBounds.width,
    height: newBounds.height,
    points: nextPoints,
  };
}
