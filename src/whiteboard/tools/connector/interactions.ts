import type {
  Attachment,
  ObjectId,
  Point,
  Viewport,
  WhiteboardObject,
} from '../../../domain/types';
import {
  getBoundingBox,
  getPorts,
  hitTest,
  isConnectable,
  resolveAttachmentPoint,
} from '../../geometry';
import type { DraftShape } from '../../drawing';

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function dist2(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function getCenter(obj: WhiteboardObject): Point {
  const b = getBoundingBox(obj);
  if (b) return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  return { x: obj.x ?? 0, y: obj.y ?? 0 };
}

/**
 * Pick an Attachment for an object based on:
 * - If the pointer is close to a named port: snap to { type: 'port' }.
 * - Otherwise:
 *   - ellipse: { type: 'perimeterAngle' } (continuous around perimeter)
 *   - rect-like: { type: 'edgeT' } (continuous along edges)
 */
export function pickAttachmentForObject(
  obj: WhiteboardObject,
  pointer: Point,
  viewport: Viewport,
  otherPoint?: Point
): Attachment {
  const zoom = viewport.zoom ?? 1;
  // Snap radius in pixels, converted to world units.
  const snapWorld = 12 / Math.max(0.0001, zoom);

  const ports = getPorts(obj);
  if (ports.length > 0) {
    let best = ports[0];
    let bestD = dist2(pointer, ports[0].point);
    for (let i = 1; i < ports.length; i++) {
      const d = dist2(pointer, ports[i].point);
      if (d < bestD) {
        bestD = d;
        best = ports[i];
      }
    }

    // Only snap to a port if we are close enough.
    if (bestD <= snapWorld * snapWorld) {
      return { type: 'port', portId: best.portId };
    }
  }

  const bounds = getBoundingBox(obj);
  if (!bounds) return { type: 'fallback', anchor: 'center' };

  const c = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const ref = otherPoint ?? pointer;

  // Continuous attachment around ellipse perimeter
  if (obj.type === 'ellipse') {
    const angle = Math.atan2(ref.y - c.y, ref.x - c.x);
    return { type: 'perimeterAngle', angleRad: angle };
  }

  // Rect-like behavior (rectangle, stickyNote, text, etc.)
  const dx = ref.x - c.x;
  const dy = ref.y - c.y;

  let edge: 'top' | 'right' | 'bottom' | 'left';
  if (Math.abs(dx) > Math.abs(dy)) {
    edge = dx >= 0 ? 'right' : 'left';
  } else {
    edge = dy >= 0 ? 'bottom' : 'top';
  }

  let t = 0.5;
  if (edge === 'top' || edge === 'bottom') {
    t = bounds.width > 0 ? (pointer.x - bounds.x) / bounds.width : 0.5;
  } else {
    t = bounds.height > 0 ? (pointer.y - bounds.y) / bounds.height : 0.5;
  }

  return { type: 'edgeT', edge, t: clamp01(t) };
}

export type ConnectorStartArgs = {
  pos: Point;
  objects: WhiteboardObject[];
  viewport: Viewport;
  strokeColor: string;
  strokeWidth: number;
  generateObjectId: () => ObjectId;
};

export function startConnectorDraft({
  pos,
  objects,
  viewport,
  strokeColor,
  strokeWidth,
  generateObjectId,
}: ConnectorStartArgs): DraftShape | null {
  const hitObj = hitTest(objects, pos.x, pos.y);
  if (!hitObj || !isConnectable(hitObj)) return null;

  const fromAttachment = pickAttachmentForObject(hitObj, pos, viewport);
  const fromPoint = resolveAttachmentPoint(hitObj, fromAttachment, pos);

  return {
    kind: 'connector',
    id: generateObjectId(),
    strokeColor,
    strokeWidth,
    fromObjectId: hitObj.id,
    fromAttachment,
    fromPoint,
    currentX: pos.x,
    currentY: pos.y,
    toObjectId: undefined,
    toAttachment: undefined,
    toPoint: undefined,
  };
}

export type ConnectorUpdateArgs = {
  draft: DraftShape;
  pos: Point;
  objects: WhiteboardObject[];
  viewport: Viewport;
};

export function updateConnectorDraft({ draft, pos, objects, viewport }: ConnectorUpdateArgs): DraftShape {
  if (draft.kind !== 'connector') return draft;

  const fromObj = objects.find((o) => o.id === draft.fromObjectId);
  const fromCenter = fromObj ? getCenter(fromObj) : draft.fromPoint;

  const hitObj = hitTest(objects, pos.x, pos.y);
  if (hitObj && isConnectable(hitObj) && hitObj.id !== draft.fromObjectId) {
    const toAttachment = pickAttachmentForObject(hitObj, pos, viewport, fromCenter);
    const toPoint = resolveAttachmentPoint(hitObj, toAttachment, fromCenter);
    return {
      ...draft,
      currentX: toPoint.x,
      currentY: toPoint.y,
      toObjectId: hitObj.id,
      toAttachment,
      toPoint,
    };
  }

  return {
    ...draft,
    currentX: pos.x,
    currentY: pos.y,
    toObjectId: undefined,
    toAttachment: undefined,
    toPoint: undefined,
  };
}

export type ConnectorFinishArgs = {
  draft: DraftShape;
  pos: Point;
  objects: WhiteboardObject[];
  viewport: Viewport;
};

export function finishConnectorDraft({ draft, pos, objects, viewport }: ConnectorFinishArgs): {
  object?: WhiteboardObject;
  selectIds?: ObjectId[];
} {
  if (draft.kind !== 'connector') return {};

  const fromObj = objects.find((o) => o.id === draft.fromObjectId);
  const fromCenter = fromObj ? getCenter(fromObj) : draft.fromPoint;

  let toObj: WhiteboardObject | undefined;
  let toAttachment: Attachment | undefined;

  if (draft.toObjectId && draft.toAttachment) {
    toObj = objects.find((o) => o.id === draft.toObjectId);
    toAttachment = draft.toAttachment;
  } else {
    const hitObj = hitTest(objects, pos.x, pos.y);
    if (hitObj && isConnectable(hitObj) && hitObj.id !== draft.fromObjectId) {
      toObj = hitObj;
      toAttachment = pickAttachmentForObject(hitObj, pos, viewport, fromCenter);
    }
  }

  if (!toObj || !toAttachment) return {};
  if (!isConnectable(toObj) || toObj.id === draft.fromObjectId) return {};

  const connector: WhiteboardObject = {
    id: draft.id,
    type: 'connector',
    x: 0,
    y: 0,
    strokeColor: draft.strokeColor,
    strokeWidth: draft.strokeWidth,
    from: { objectId: draft.fromObjectId, attachment: draft.fromAttachment },
    to: { objectId: toObj.id, attachment: toAttachment },
    routing: 'straight',
  };

  return { object: connector, selectIds: [connector.id] };
}
