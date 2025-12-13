// src/whiteboard/tools/connector/geometry.ts

import type {
  WhiteboardObject,
  WhiteboardState,
  Attachment,
  Point
} from '../../../domain/types';
import type { Bounds } from '../../geometry/types';

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

function getObjectCenter(obj: WhiteboardObject): Point {
  const b = {
    x: obj.x,
    y: obj.y,
    width: obj.width ?? 0,
    height: obj.height ?? 0
  };
  return getBoundsCenter(b);
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
 * For Step 2, return empty by default.
 */
export function getPorts(
  _obj: WhiteboardObject
): Array<{ portId: string; point: Point }> {
  return [];
}

/**
 * Resolve an attachment to a world coordinate point for a given object.
 */
export function resolveAttachmentPoint(
  obj: WhiteboardObject,
  att: Attachment,
  _hint?: Point
): Point {
  const bounds: Bounds = {
    x: obj.x,
    y: obj.y,
    width: obj.width ?? 0,
    height: obj.height ?? 0
  };

  const fallbackXY: Point = {
    x: typeof obj.x === 'number' ? obj.x : 0,
    y: typeof obj.y === 'number' ? obj.y : 0
  };

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
      return fallbackXY;
  }
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

export function getConnectorBoundingBox(
  obj: WhiteboardObject,
  stateOrObjects?: WhiteboardState | WhiteboardObject[]
): Bounds | null {
  if (obj.type !== 'connector') return null;
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

export function hitTestConnector(
  objects: WhiteboardObject[],
  connector: WhiteboardObject,
  x: number,
  y: number
): boolean {
  if (connector.type !== 'connector') return false;
  const endpoints = resolveConnectorEndpoints(objects, connector);
  if (!endpoints) return false;

  const { p1, p2 } = endpoints;
  const minX = Math.min(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxX = Math.max(p1.x, p2.x);
  const maxY = Math.max(p1.y, p2.y);

  const stroke = connector.strokeWidth ?? 2;
  const pad = stroke / 2 + 6;

  // quick reject
  if (x < minX - pad || x > maxX + pad || y < minY - pad || y > maxY + pad) {
    return false;
  }

  const tolerance = pad;
  const d = distancePointToSegment({ x, y }, p1, p2);
  return d <= tolerance;
}
