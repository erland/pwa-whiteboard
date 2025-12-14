// src/whiteboard/tools/line/geometry.ts

import type { WhiteboardObject, Point } from '../../../domain/types';
import type { Bounds } from '../../geometry/types';

function rawEndpoints(obj: WhiteboardObject): { a: Point; b: Point } {
  const a: Point = { x: obj.x, y: obj.y };
  const b: Point = { x: obj.x2 ?? obj.x, y: obj.y2 ?? obj.y };
  return { a, b };
}

/** Bounding box (world units) for a straight line (including a small padding). */
export function getLineBoundingBox(obj: WhiteboardObject): Bounds | null {
  if (obj.type !== 'line') return null;

  const { a, b } = rawEndpoints(obj);
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x, b.x);
  const maxY = Math.max(a.y, b.y);

  // Stroke width is interpreted as canvas px; in v1 we treat world units ~ px at zoom=1.
  // Add a few extra world units to make selection easier.
  const stroke = obj.strokeWidth ?? 2;
  const pad = stroke / 2 + 6;

  return {
    x: minX - pad,
    y: minY - pad,
    width: (maxX - minX) + pad * 2,
    height: (maxY - minY) + pad * 2,
  };
}

/** Distance from point P to line segment AB in world units. */
function distancePointToSegment(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;

  const apx = p.x - a.x;
  const apy = p.y - a.y;

  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) {
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = a.x + t * abx;
  const closestY = a.y + t * aby;

  const dx = p.x - closestX;
  const dy = p.y - closestY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function hitTestLine(obj: WhiteboardObject, x: number, y: number): boolean {
  if (obj.type !== 'line') return false;
  const { a, b } = rawEndpoints(obj);

  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x, b.x);
  const maxY = Math.max(a.y, b.y);

  const stroke = obj.strokeWidth ?? 2;
  const pad = stroke / 2 + 6;

  // quick reject
  if (x < minX - pad || x > maxX + pad || y < minY - pad || y > maxY + pad) {
    return false;
  }

  const d = distancePointToSegment({ x, y }, a, b);
  return d <= pad;
}

export function translateLineObject(obj: WhiteboardObject, dx: number, dy: number): Partial<WhiteboardObject> {
  if (obj.type !== 'line') return {};
  return {
    x: obj.x + dx,
    y: obj.y + dy,
    x2: (obj.x2 ?? obj.x) + dx,
    y2: (obj.y2 ?? obj.y) + dy,
  };
}

function getRawBoundsNoPad(obj: WhiteboardObject): Bounds {
  const { a, b } = rawEndpoints(obj);
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x, b.x);
  const maxY = Math.max(a.y, b.y);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function resizeLineObject(obj: WhiteboardObject, newBounds: Bounds): Partial<WhiteboardObject> {
  if (obj.type !== 'line') return {};

  const { a, b } = rawEndpoints(obj);
  const old = getRawBoundsNoPad(obj);

  const nxA = old.width === 0 ? 0 : (a.x - old.x) / old.width;
  const nyA = old.height === 0 ? 0 : (a.y - old.y) / old.height;
  const nxB = old.width === 0 ? 1 : (b.x - old.x) / old.width;
  const nyB = old.height === 0 ? 1 : (b.y - old.y) / old.height;

  const ax = newBounds.x + nxA * newBounds.width;
  const ay = newBounds.y + nyA * newBounds.height;
  const bx = newBounds.x + nxB * newBounds.width;
  const by = newBounds.y + nyB * newBounds.height;

  return { x: ax, y: ay, x2: bx, y2: by };
}
