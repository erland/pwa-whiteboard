// src/whiteboard/geometry.ts
import type {
  WhiteboardObject,
  Viewport,
  Point,
  WhiteboardState
} from '../domain/types';

import type { Bounds, ResizeHandleId } from './geometry/types';
import { getHandlePositions, resizeBounds } from './geometry/handles';
import { getShape, getPortsFor } from './tools/shapeRegistry';

// NOTE: Connector-specific helpers are still re-exported from the connector tool module
// for backwards compatibility. A later step can move these behind the shape registry.
export {
  resolveAttachmentPoint,
  resolveConnectorEndpoints,
} from './tools/connector/geometry';

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
 * Registry-driven dispatch:
 * - The specific shape/tool implementation owns its bounding box computation.
 * - Some object types (e.g. connector) require the full object list to resolve endpoints;
 *   pass `stateOrObjects` for those cases.
 */
export function getBoundingBox(
  obj: WhiteboardObject,
  stateOrObjects?: WhiteboardState | WhiteboardObject[]
): Bounds | null {
  const objects = Array.isArray(stateOrObjects)
    ? stateOrObjects
    : stateOrObjects?.objects;

  const shape = getShape(obj.type);
  return shape.getBoundingBox(obj, objects ? { objects } : undefined);
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
 *
 * Registry-driven dispatch:
 * - If the shape provides a precise hitTest, use it.
 * - Otherwise fall back to bounding-box hit testing.
 */
export function hitTest(
  objects: WhiteboardObject[],
  x: number,
  y: number
): WhiteboardObject | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    const shape = getShape(obj.type);

    if (shape.hitTest) {
      if (shape.hitTest(obj, x, y, { objects })) return obj;
      continue;
    }

    const box = shape.getBoundingBox(obj, { objects });
    if (!box) continue;

    const x2 = box.x + box.width;
    const y2 = box.y + box.height;

    if (x >= box.x && x <= x2 && y >= box.y && y <= y2) {
      return obj;
    }
  }

  return null;
}

/**
 * Backwards-compatible helper used by some existing code:
 * an object is connectable if it exposes at least one port.
 */
export function isConnectable(obj: WhiteboardObject): boolean {
  return getPortsFor(obj).length > 0;
}

/**
 * Backwards-compatible helper used by some existing code.
 */
export function getPorts(obj: WhiteboardObject) {
  return getPortsFor(obj);
}
