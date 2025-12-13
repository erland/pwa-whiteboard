// src/whiteboard/geometry.ts
import type {
  WhiteboardObject,
  Viewport,
  Point,
  Attachment,
  WhiteboardState
} from '../domain/types';

import type { Bounds, ResizeHandleId } from './geometry/types';
import { getHandlePositions, resizeBounds } from './geometry/handles';
import { getConnectorBoundingBox, hitTestConnector } from './tools/connector/geometry';
import { getFreehandBoundingBox } from './tools/freehand/geometry';
import { getRectangleBoundingBox } from './tools/rectangle/geometry';
import { getEllipseBoundingBox } from './tools/ellipse/geometry';
import { getTextBoundingBox } from './tools/text/geometry';
import { getStickyNoteBoundingBox } from './tools/stickyNote/geometry';

export type { Bounds, ResizeHandleId };

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
 *
 * For connectors:
 * - Provide `stateOrObjects` so we can resolve endpoints and compute a padded bounds.
 * - If not provided, returns null.
 */
export function getBoundingBox(
  obj: WhiteboardObject,
  stateOrObjects?: WhiteboardState | WhiteboardObject[]
): Bounds | null {
  switch (obj.type) {
    case 'connector':
      return getConnectorBoundingBox(obj, stateOrObjects);
    case 'freehand':
      return getFreehandBoundingBox(obj);
    case 'rectangle':
      return getRectangleBoundingBox(obj);
    case 'ellipse':
      return getEllipseBoundingBox(obj);
    case 'text':
      return getTextBoundingBox(obj);
    case 'stickyNote':
      return getStickyNoteBoundingBox(obj);
    default:
      return null;
  }
}

export { getHandlePositions, resizeBounds };

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
 * Hit-test objects from topmost to bottom-most.
 * x, y are world coordinates.
 */
/**
 * Hit-test objects from topmost to bottom-most.
 * x, y are world coordinates.
 */
export function hitTest(
  objects: WhiteboardObject[],
  x: number,
  y: number
): WhiteboardObject | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];

    if (obj.type === 'connector') {
      if (hitTestConnector(objects, obj, x, y)) return obj;
      continue;
    }

    // Default bbox hit test
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

// Connector-related exports (kept in geometry.ts for backwards compatibility)
export {
  isConnectable,
  getPorts,
  resolveAttachmentPoint,
  resolveConnectorEndpoints
} from './tools/connector/geometry';