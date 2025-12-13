// src/whiteboard/geometry.ts
import type {
  WhiteboardObject,
  Viewport,
  Point,
  Attachment,
  WhiteboardState
} from '../domain/types';

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
 *
 * For connectors:
 * - Provide `stateOrObjects` so we can resolve endpoints and compute a padded bounds.
 * - If not provided, returns null.
 */
export function getBoundingBox(
  obj: WhiteboardObject,
  stateOrObjects?: WhiteboardState | WhiteboardObject[]
): Bounds | null {
  if (obj.type === 'connector') {
    if (!stateOrObjects) return null;

    const endpoints = resolveConnectorEndpoints(stateOrObjects, obj);
    if (!endpoints) return null;

    const { p1, p2 } = endpoints;

    const minX = Math.min(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxX = Math.max(p1.x, p2.x);
    const maxY = Math.max(p1.y, p2.y);

    // Stroke width is interpreted as canvas px, but in v1 we treat world units ~ px at zoom=1.
    // Add a few extra world units to make selection easier.
    const stroke = obj.strokeWidth ?? 2;
    const pad = stroke / 2 + 6;

    return {
      x: minX - pad,
      y: minY - pad,
      width: (maxX - minX) + pad * 2,
      height: (maxY - minY) + pad * 2
    };
  }

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
 * Distance from point P to line segment AB in world units.
 */
function distancePointToSegment(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;

  const apx = p.x - a.x;
  const apy = p.y - a.y;

  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) {
    // A and B are the same point
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Project AP onto AB, clamp to segment [0..1]
  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = a.x + t * abx;
  const closestY = a.y + t * aby;

  const dx = p.x - closestX;
  const dy = p.y - closestY;
  return Math.sqrt(dx * dx + dy * dy);
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
  const p: Point = { x, y };

  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];

    // Connector hit test: distance-to-segment with tolerance
    if (obj.type === 'connector') {
      const endpoints = resolveConnectorEndpoints(objects, obj);
      if (!endpoints) continue;

      const { p1, p2 } = endpoints;

      // Compute padded bounds directly (avoids calling getBoundingBox -> resolves endpoints again)
      const minX = Math.min(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxX = Math.max(p1.x, p2.x);
      const maxY = Math.max(p1.y, p2.y);

      const stroke = obj.strokeWidth ?? 2;
      const pad = stroke / 2 + 6;

      // quick reject
      if (
        x < minX - pad ||
        x > maxX + pad ||
        y < minY - pad ||
        y > maxY + pad
      ) {
        continue;
      }

      const tolerance = pad;
      const d = distancePointToSegment(p, p1, p2);

      if (d <= tolerance) return obj;
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

/* ======================================================================================
 * Step 2 additions: connectability + attachment resolution (for modeling-style connectors)
 * ====================================================================================== */

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function getBoundsCenter(b: Bounds): Point {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

function getAnchorPoint(
  bounds: Bounds,
  anchor: 'center' | 'top' | 'right' | 'bottom' | 'left'
): Point {
  const { x, y, width, height } = bounds;
  const cx = x + width / 2;
  const cy = y + height / 2;
  switch (anchor) {
    case 'top':
      return { x: cx, y };
    case 'right':
      return { x: x + width, y: cy };
    case 'bottom':
      return { x: cx, y: y + height };
    case 'left':
      return { x, y: cy };
    case 'center':
    default:
      return { x: cx, y: cy };
  }
}

/**
 * Whether an object can be a connector endpoint target.
 * For now we intentionally disallow connecting to freehand and connectors.
 */
export function isConnectable(obj: WhiteboardObject): boolean {
  if (!obj) return false;
  if (obj.type === 'connector') return false;
  if (obj.type === 'freehand') return false; // keep simple for v1
  return (
    obj.type === 'rectangle' ||
    obj.type === 'ellipse' ||
    obj.type === 'text' ||
    obj.type === 'stickyNote'
  );
}

/**
 * Optional named ports exposed by objects.
 * For Step 2, return empty by default. (Later: process-arrow tip/tail ports, etc.)
 */
export function getPorts(
  _obj: WhiteboardObject
): Array<{ portId: string; point: Point }> {
  return [];
}

/**
 * Resolve an attachment to a world coordinate point for a given object.
 * `hint` is optional and reserved for future logic (snapping/closest-point/etc.).
 */
export function resolveAttachmentPoint(
  obj: WhiteboardObject,
  att: Attachment,
  _hint?: Point
): Point {
  const bounds = getBoundingBox(obj);

  // If bounds are missing, fall back to x/y if present.
  const fallbackXY: Point = {
    x: typeof obj.x === 'number' ? obj.x : 0,
    y: typeof obj.y === 'number' ? obj.y : 0
  };

  if (!bounds) {
    if (att.type === 'fallback') return fallbackXY;
    return fallbackXY;
  }

  switch (att.type) {
    case 'port': {
      const ports = getPorts(obj);
      const found = ports.find((p) => p.portId === att.portId);
      return found?.point ?? getAnchorPoint(bounds, 'center');
    }

    case 'edgeT': {
      const t = clamp01(att.t);
      const { x, y, width, height } = bounds;
      switch (att.edge) {
        case 'top':
          return { x: x + t * width, y };
        case 'right':
          return { x: x + width, y: y + t * height };
        case 'bottom':
          return { x: x + t * width, y: y + height };
        case 'left':
          return { x, y: y + t * height };
        default:
          return getAnchorPoint(bounds, 'center');
      }
    }

    case 'perimeterAngle': {
      const c = getBoundsCenter(bounds);
      const rx = bounds.width / 2;
      const ry = bounds.height / 2;
      if (rx <= 0 || ry <= 0) return c;

      const a = att.angleRad;
      return {
        x: c.x + Math.cos(a) * rx,
        y: c.y + Math.sin(a) * ry
      };
    }

    case 'fallback': {
      return getAnchorPoint(bounds, att.anchor);
    }

    default:
      return getAnchorPoint(bounds, 'center');
  }
}

function getObjectCenter(obj: WhiteboardObject): Point {
  const b = getBoundingBox(obj);
  if (!b) {
    return {
      x: typeof obj.x === 'number' ? obj.x : 0,
      y: typeof obj.y === 'number' ? obj.y : 0
    };
  }
  return getBoundsCenter(b);
}

/**
 * Resolve connector endpoints to concrete world points.
 */
export function resolveConnectorEndpoints(
  stateOrObjects: WhiteboardState | WhiteboardObject[],
  connector: WhiteboardObject
): { p1: Point; p2: Point } | null {
  if (!connector || connector.type !== 'connector') return null;
  if (!connector.from || !connector.to) return null;

  const objects = Array.isArray(stateOrObjects)
    ? stateOrObjects
    : stateOrObjects.objects;

  const fromObj = objects.find((o) => o.id === connector.from!.objectId);
  const toObj = objects.find((o) => o.id === connector.to!.objectId);
  if (!fromObj || !toObj) return null;
  if (!isConnectable(fromObj) || !isConnectable(toObj)) return null;

  const toHint = getObjectCenter(toObj);
  const fromHint = getObjectCenter(fromObj);

  const p1 = resolveAttachmentPoint(fromObj, connector.from.attachment, toHint);
  const p2 = resolveAttachmentPoint(toObj, connector.to.attachment, fromHint);

  return { p1, p2 };
}