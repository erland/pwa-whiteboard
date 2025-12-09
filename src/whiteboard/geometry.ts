// src/whiteboard/geometry.ts
import type { WhiteboardObject, Viewport, Point } from '../domain/types';

export type ResizeHandleId =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w';

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Convert world coordinates → canvas coordinates.
 */
export function worldToCanvas(
  x: number,
  y: number,
  viewport: Viewport
): { x: number; y: number } {
  const zoom = viewport.zoom ?? 1;
  const offsetX = viewport.offsetX ?? 0;
  const offsetY = viewport.offsetY ?? 0;
  return {
    x: (x + offsetX) * zoom,
    y: (y + offsetY) * zoom
  };
}

/**
 * Convert canvas pixel coordinates → world coordinates.
 */
export function canvasToWorld(
  canvasX: number,
  canvasY: number,
  viewport: Viewport
): Point {
  const zoom = viewport.zoom ?? 1;
  const offsetX = viewport.offsetX ?? 0;
  const offsetY = viewport.offsetY ?? 0;
  return {
    x: canvasX / zoom - offsetX,
    y: canvasY / zoom - offsetY
  };
}

/**
 * Compute the bounding box of an object in world coordinates.
 */
export function getBoundingBox(obj: WhiteboardObject): Bounds | null {
  if (typeof obj.x !== 'number' || typeof obj.y !== 'number') {
    return null;
  }
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
 * Positions of the eight resize handles around a bounding box (in world coords).
 */
export function getHandlePositions(bounds: Bounds): Record<ResizeHandleId, Point> {
  const { x, y, width, height } = bounds;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const right = x + width;
  const bottom = y + height;

  return {
    nw: { x, y },
    n: { x: cx, y },
    ne: { x: right, y },
    e: { x: right, y: cy },
    se: { x: right, y: bottom },
    s: { x: cx, y: bottom },
    sw: { x, y: bottom },
    w: { x, y: cy }
  };
}

/**
 * Hit-testing for resize handles, using canvas pixel coordinates.
 */
export function hitTestResizeHandleCanvas(
  pointerCanvasX: number,
  pointerCanvasY: number,
  bounds: Bounds,
  viewport: Viewport
): ResizeHandleId | null {
  const HANDLE_SIZE = 10; // px
  const half = HANDLE_SIZE / 2;

  const handles = getHandlePositions(bounds);

  for (const [id, pos] of Object.entries(handles) as [ResizeHandleId, Point][]) {
    const c = worldToCanvas(pos.x, pos.y, viewport);
    if (
      pointerCanvasX >= c.x - half &&
      pointerCanvasX <= c.x + half &&
      pointerCanvasY >= c.y - half &&
      pointerCanvasY <= c.y + half
    ) {
      return id;
    }
  }

  return null;
}

/**
 * Resize a bounding box given a handle and delta movement in world coords.
 */
export function resizeBounds(
  original: Bounds,
  handle: ResizeHandleId,
  dx: number,
  dy: number
): Bounds {
  const MIN_SIZE = 4;

  let { x, y, width, height } = original;

  // Horizontal adjustment
  switch (handle) {
    case 'e':
    case 'ne':
    case 'se': {
      width = Math.max(MIN_SIZE, original.width + dx);
      break;
    }
    case 'w':
    case 'nw':
    case 'sw': {
      const newWidth = Math.max(MIN_SIZE, original.width - dx);
      x = original.x + (original.width - newWidth);
      width = newWidth;
      break;
    }
    default:
      break;
  }

  // Vertical adjustment
  switch (handle) {
    case 's':
    case 'se':
    case 'sw': {
      height = Math.max(MIN_SIZE, original.height + dy);
      break;
    }
    case 'n':
    case 'ne':
    case 'nw': {
      const newHeight = Math.max(MIN_SIZE, original.height - dy);
      y = original.y + (original.height - newHeight);
      height = newHeight;
      break;
    }
    default:
      break;
  }

  return { x, y, width, height };
}

/**
 * Hit-test objects from topmost to bottom-most using their bounding boxes.
 * x, y are world coordinates.
 */
export function hitTest(
  objects: WhiteboardObject[],
  x: number,
  y: number
): WhiteboardObject | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    const box = getBoundingBox(obj);
    if (!box) continue;
    const x2 = box.x + box.width;
    const y2 = box.y + box.height;
    if (x >= box.x && x <= x2 && y >= box.y && y <= y2) {
      return obj;
    }
  }
  return null;
}