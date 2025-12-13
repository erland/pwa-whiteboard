// src/whiteboard/useCanvasInteractions.ts
import { useState } from 'react';
import type React from 'react';
import type {
  WhiteboardObject,
  Viewport,
  ObjectId,
  Point,
  Attachment
} from '../domain/types';
import {
  getBoundingBox,
  hitTest,
  hitTestResizeHandleCanvas,
  resizeBounds,
  Bounds,
  ResizeHandleId,
  worldToCanvas,
  canvasToWorld,
  isConnectable,
  getPorts,
  resolveAttachmentPoint,
  resolveConnectorEndpoints
} from './geometry';
import type { DraftShape } from './drawing';
import type { DrawingTool } from './whiteboardTypes';

type ResizeDragState = {
  kind: 'resize';
  objectId: ObjectId;
  handle: ResizeHandleId;
  startX: number; // world coords at pointer-down
  startY: number;
  originalBounds: Bounds;
};

type MoveDragState = {
  kind: 'move';
  objectId: ObjectId;
  lastX: number;
  lastY: number;
};

type PanDragState = {
  kind: 'pan';
  startCanvasX: number;
  startCanvasY: number;
  startOffsetX: number;
  startOffsetY: number;
  zoomAtStart: number;
};

type ConnectorEndpointDragState = {
  kind: 'connectorEndpoint';
  connectorId: ObjectId;
  endpoint: 'from' | 'to';
};

type DragState =
  | MoveDragState
  | PanDragState
  | ResizeDragState
  | ConnectorEndpointDragState;

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
 * - ports (if any) preferred
 * - ellipse: perimeterAngle facing `otherPoint` (or pointer)
 * - rect-like: edgeT on side facing `otherPoint` (or pointer), with t from pointer projection
 */
function pickAttachmentForObject(
  obj: WhiteboardObject,
  pointer: Point,
  otherPoint?: Point
): Attachment {
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
    return { type: 'port', portId: best.portId };
  }

  const bounds = getBoundingBox(obj);
  if (!bounds) {
    return { type: 'fallback', anchor: 'center' };
  }

  const c = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const ref = otherPoint ?? pointer;

  if (obj.type === 'ellipse') {
    const angle = Math.atan2(ref.y - c.y, ref.x - c.x);
    return { type: 'perimeterAngle', angleRad: angle };
  }

  // Rect-like behavior (rectangle, text, stickyNote)
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


function hitTestConnectableObject(
  objects: WhiteboardObject[],
  x: number,
  y: number
): WhiteboardObject | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    if (!isConnectable(obj)) continue;
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

function getConnectorEndpointHit(
  connector: WhiteboardObject,
  objects: WhiteboardObject[],
  viewport: Viewport,
  pointerCanvasX: number,
  pointerCanvasY: number
): 'from' | 'to' | null {
  const endpoints = resolveConnectorEndpoints(objects, connector);
  if (!endpoints) return null;

  const a = worldToCanvas(endpoints.p1.x, endpoints.p1.y, viewport);
  const b = worldToCanvas(endpoints.p2.x, endpoints.p2.y, viewport);

  const dxA = pointerCanvasX - a.x;
  const dyA = pointerCanvasY - a.y;
  const dxB = pointerCanvasX - b.x;
  const dyB = pointerCanvasY - b.y;

  const dA2 = dxA * dxA + dyA * dyA;
  const dB2 = dxB * dxB + dyB * dyB;

  // Match the visual endpoint handle (~5px) but make it easier to grab.
  const HIT_R = 10;
  const hit2 = HIT_R * HIT_R;

  const hitA = dA2 <= hit2;
  const hitB = dB2 <= hit2;
  if (!hitA && !hitB) return null;
  if (hitA && !hitB) return 'from';
  if (!hitA && hitB) return 'to';

  // Both: pick the closest.
  return dA2 <= dB2 ? 'from' : 'to';
}

export type CanvasInteractionsParams = {
  objects: WhiteboardObject[];
  selectedObjectIds: ObjectId[];
  viewport: Viewport;
  activeTool: DrawingTool;
  strokeColor: string;
  strokeWidth: number;
  onCreateObject: (object: WhiteboardObject) => void;
  onSelectionChange: (selectedIds: ObjectId[]) => void;
  onUpdateObject: (objectId: ObjectId, patch: Partial<WhiteboardObject>) => void;
  onViewportChange: (patch: Partial<Viewport>) => void;
  canvasWidth: number;
  canvasHeight: number;
};

export type CanvasInteractionsResult = {
  draft: DraftShape | null;
  handlePointerDown: (evt: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerMove: (evt: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerUp: (evt: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerLeave: (evt: React.PointerEvent<HTMLCanvasElement>) => void;
};

export function useCanvasInteractions({
  objects,
  selectedObjectIds,
  viewport,
  activeTool,
  strokeColor,
  strokeWidth,
  onCreateObject,
  onSelectionChange,
  onUpdateObject,
  onViewportChange,
  canvasWidth,
  canvasHeight
}: CanvasInteractionsParams): CanvasInteractionsResult {
  const [draft, setDraft] = useState<DraftShape | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const generateObjectId = () =>
    ('o_' +
      Math.random().toString(16).slice(2) +
      '_' +
      Date.now().toString(16)) as ObjectId;

  const getCanvasPos = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = evt.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();

    // Map from CSS pixels → logical canvas pixels (0..canvasWidth / 0..canvasHeight)
    const scaleX = canvasWidth / rect.width || 1;
    const scaleY = canvasHeight / rect.height || 1;

    const canvasX = (evt.clientX - rect.left) * scaleX;
    const canvasY = (evt.clientY - rect.top) * scaleY;

    return canvasToWorld(canvasX, canvasY, viewport);
  };

  const getCanvasXY = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = evt.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width || 1;
    const scaleY = canvasHeight / rect.height || 1;
    const canvasX = (evt.clientX - rect.left) * scaleX;
    const canvasY = (evt.clientY - rect.top) * scaleY;
    return { canvasX, canvasY };
  };

  const setPointerCaptureSafe = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const el = evt.target as HTMLCanvasElement;
    try {
      (el as any).setPointerCapture?.(evt.pointerId);
    } catch {
      // ignore
    }
  };

  const releasePointerCaptureSafe = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const el = evt.target as HTMLCanvasElement;
    try {
      (el as any).releasePointerCapture?.(evt.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerDown = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    // Ignore non-left *mouse* buttons; don't block touch.
    if (evt.pointerType === 'mouse' && evt.button !== 0) return;

    const pos = getCanvasPos(evt); // world coords

    if (activeTool === 'connector') {
      const hitObj = hitTest(objects, pos.x, pos.y);
      if (!hitObj || !isConnectable(hitObj)) return;

      const fromAttachment = pickAttachmentForObject(hitObj, pos);
      const fromPoint = resolveAttachmentPoint(hitObj, fromAttachment, pos);

      setDraft({
        kind: 'connector',
        id: generateObjectId(),
        strokeColor,
        strokeWidth,
        fromObjectId: hitObj.id,
        fromAttachment,
        fromPoint,
        currentX: pos.x,
        currentY: pos.y,
        // NEW: snapped target info (starts empty)
        toObjectId: undefined,
        toAttachment: undefined,
        toPoint: undefined
      });

      setPointerCaptureSafe(evt);
      return;
    }

    // Only compute canvasX/Y when needed (select tool)
    const { canvasX, canvasY } = getCanvasXY(evt);

    if (activeTool === 'select') {
      // 1) Resize if exactly one object selected and we hit a handle
      if (selectedObjectIds.length === 1) {
        const selectedId = selectedObjectIds[0];
        const selectedObj = objects.find((o) => o.id === selectedId);

        // Disallow resize on freehand + connectors
        if (
          selectedObj &&
          selectedObj.type !== 'freehand' &&
          selectedObj.type !== 'connector'
        ) {
          const box = getBoundingBox(selectedObj);
          if (box) {
            const handleId = hitTestResizeHandleCanvas(
              canvasX,
              canvasY,
              box as Bounds,
              viewport
            );
            if (handleId) {
              setDrag({
                kind: 'resize',
                objectId: selectedId,
                handle: handleId,
                startX: pos.x,
                startY: pos.y,
                originalBounds: {
                  x: box.x,
                  y: box.y,
                  width: box.width,
                  height: box.height
                }
              });
              setPointerCaptureSafe(evt);
              return;
            }
          }
        }
      }

      // 2) Move selection or pan
      const hitObj = hitTest(objects, pos.x, pos.y);
      if (hitObj) {
        // Special-case connectors: allow dragging endpoints to retarget / move anchors.
        if (hitObj.type === 'connector') {
          onSelectionChange([hitObj.id]);

          const endpoint = getConnectorEndpointHit(
            hitObj,
            objects,
            viewport,
            canvasX,
            canvasY
          );

          if (endpoint) {
            setDrag({
              kind: 'connectorEndpoint',
              connectorId: hitObj.id,
              endpoint
            });
            setPointerCaptureSafe(evt);
            return;
          }

          // Clicked the connector line, but not an endpoint handle: select only.
          setPointerCaptureSafe(evt);
          return;
        }

        onSelectionChange([hitObj.id]);
        setDrag({
          kind: 'move',
          objectId: hitObj.id,
          lastX: pos.x,
          lastY: pos.y
        });
      } else {
        onSelectionChange([]);
        setDrag({
          kind: 'pan',
          startCanvasX: canvasX,
          startCanvasY: canvasY,
          startOffsetX: viewport.offsetX ?? 0,
          startOffsetY: viewport.offsetY ?? 0,
          zoomAtStart: viewport.zoom ?? 1
        });
      }

      setPointerCaptureSafe(evt);
      return;
    }

    if (activeTool === 'text') {
      const id = generateObjectId();
      const obj: WhiteboardObject = {
        id,
        type: 'text',
        x: pos.x,
        y: pos.y,
        width: 200,
        height: 40,
        strokeColor,
        textColor: strokeColor,
        strokeWidth,
        fontSize: 18,
        text: 'Text'
      };
      onCreateObject(obj);
      onSelectionChange([id]);
      return;
    }

    if (activeTool === 'stickyNote') {
      const id = generateObjectId();
      const obj: WhiteboardObject = {
        id,
        type: 'stickyNote',
        x: pos.x,
        y: pos.y,
        width: 200,
        height: 140,
        strokeColor,
        strokeWidth,
        fillColor: '#facc15',
        fontSize: 16,
        textColor: strokeColor,
        text: 'Sticky note'
      };
      onCreateObject(obj);
      onSelectionChange([id]);
      return;
    }

    if (activeTool === 'freehand') {
      setDraft({
        kind: 'freehand',
        id: generateObjectId(),
        strokeColor,
        strokeWidth,
        points: [pos]
      });
      setPointerCaptureSafe(evt);
      return;
    }

    if (activeTool === 'rectangle' || activeTool === 'ellipse') {
      setDraft({
        kind: activeTool,
        id: generateObjectId(),
        strokeColor,
        strokeWidth,
        startX: pos.x,
        startY: pos.y,
        currentX: pos.x,
        currentY: pos.y
      });
      setPointerCaptureSafe(evt);
      return;
    }
  };

  const handlePointerMove = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(evt); // world coords

    // Connector draft updates (no need for canvasX/canvasY)
    if (draft && draft.kind === 'connector') {
      const fromObj = objects.find((o) => o.id === draft.fromObjectId);
      const fromCenter = fromObj ? getCenter(fromObj) : draft.fromPoint;

      const hitObj = hitTest(objects, pos.x, pos.y);

      if (hitObj && isConnectable(hitObj) && hitObj.id !== draft.fromObjectId) {
        const toAttachment = pickAttachmentForObject(hitObj, pos, fromCenter);
        const toPoint = resolveAttachmentPoint(hitObj, toAttachment, fromCenter);

        setDraft({
          ...draft,
          currentX: toPoint.x,
          currentY: toPoint.y,
          toObjectId: hitObj.id,
          toAttachment,
          toPoint
        });
      } else {
        setDraft({
          ...draft,
          currentX: pos.x,
          currentY: pos.y,
          toObjectId: undefined,
          toAttachment: undefined,
          toPoint: undefined
        });
      }
      return;
    }

    // Update other draft shapes (no need for canvasX/canvasY)
    if (draft) {
      setDraft((current) => {
        if (!current) return current;
        if (current.kind === 'freehand') {
          return { ...current, points: [...current.points, pos] };
        }
        return { ...current, currentX: pos.x, currentY: pos.y };
      });
      return;
    }

    if (!drag || activeTool !== 'select') return;

    // Now we may need canvas coords (pan)
    const { canvasX, canvasY } = getCanvasXY(evt);

    if (drag.kind === 'connectorEndpoint') {
      const connector = objects.find((o) => o.id === drag.connectorId);
      if (!connector || connector.type !== 'connector') return;

      // Resolve the *other* endpoint so the attachment can "face" it.
      const endpoints = resolveConnectorEndpoints(objects, connector);
      const otherPoint = endpoints
        ? drag.endpoint === 'from'
          ? endpoints.p2
          : endpoints.p1
        : pos;

      // Prefer re-attaching to the connectable object currently under pointer.
      const hoverObj = hitTestConnectableObject(objects, pos.x, pos.y);

      // Otherwise, move along the currently attached object (if still present).
      const attachedId =
        drag.endpoint === 'from'
          ? connector.from?.objectId
          : connector.to?.objectId;
      const attachedObj = attachedId
        ? objects.find((o) => o.id === attachedId)
        : undefined;

      const targetObj = hoverObj ?? (attachedObj && isConnectable(attachedObj) ? attachedObj : null);
      if (!targetObj) return;

      const newAttachment = pickAttachmentForObject(targetObj, pos, pos);

      if (drag.endpoint === 'from') {
        onUpdateObject(connector.id, {
          from: { objectId: targetObj.id, attachment: newAttachment }
        });
      } else {
        onUpdateObject(connector.id, {
          to: { objectId: targetObj.id, attachment: newAttachment }
        });
      }

      return;
    }

    if (drag.kind === 'move') {
      const dx = pos.x - drag.lastX;
      const dy = pos.y - drag.lastY;
      if (dx === 0 && dy === 0) return;

      const obj = objects.find((o) => o.id === drag.objectId);
      if (!obj) return;

      // Do not move connectors (they are attached semantically)
      if (obj.type === 'connector') {
        setDrag({ ...drag, lastX: pos.x, lastY: pos.y });
        return;
      }

      onUpdateObject(obj.id, { x: obj.x + dx, y: obj.y + dy });
      setDrag({ ...drag, lastX: pos.x, lastY: pos.y });
      return;
    }

    if (drag.kind === 'pan') {
      const dxCanvas = canvasX - drag.startCanvasX;
      const dyCanvas = canvasY - drag.startCanvasY;
      const zoom = drag.zoomAtStart || 1;

      onViewportChange({
        offsetX: drag.startOffsetX + dxCanvas / zoom,
        offsetY: drag.startOffsetY + dyCanvas / zoom
      });
      return;
    }

    if (drag.kind === 'resize') {
      const dx = pos.x - drag.startX;
      const dy = pos.y - drag.startY;
      const newBounds = resizeBounds(drag.originalBounds, drag.handle, dx, dy);

      const obj = objects.find((o) => o.id === drag.objectId);
      if (!obj) return;

      if (obj.type !== 'freehand' && obj.type !== 'connector') {
        onUpdateObject(drag.objectId, {
          x: newBounds.x,
          y: newBounds.y,
          width: newBounds.width,
          height: newBounds.height
        });
      }
    }
  };

  const commitDraft = () => {
    if (!draft) return;

    // Connector draft is committed on pointer-up only
    if (draft.kind === 'connector') return;

    if (draft.kind === 'freehand') {
      if (draft.points.length < 2) {
        setDraft(null);
        return;
      }

      const xs = draft.points.map((p) => p.x);
      const ys = draft.points.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);

      const obj: WhiteboardObject = {
        id: draft.id,
        type: 'freehand',
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        strokeColor: draft.strokeColor,
        strokeWidth: draft.strokeWidth,
        points: draft.points
      };

      onCreateObject(obj);
      onSelectionChange([draft.id]);
      setDraft(null);
      return;
    }

    const { startX, startY, currentX, currentY, kind } = draft;
    if (startX === currentX && startY === currentY) {
      setDraft(null);
      return;
    }

    const x1 = Math.min(startX, currentX);
    const y1 = Math.min(startY, currentY);
    const x2 = Math.max(startX, currentX);
    const y2 = Math.max(startY, currentY);

    const obj: WhiteboardObject = {
      id: draft.id,
      type: kind === 'rectangle' ? 'rectangle' : 'ellipse',
      x: x1,
      y: y1,
      width: x2 - x1,
      height: y2 - y1,
      strokeColor,
      strokeWidth
    };

    onCreateObject(obj);
    onSelectionChange([draft.id]);
    setDraft(null);
  };

  const finishInteraction = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    if (draft && draft.kind !== 'connector') {
      commitDraft();
    }

    setDraft(null);
    setDrag(null);
    releasePointerCaptureSafe(evt);
  };

  const handlePointerUp = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(evt);

    // Commit connector on pointer up:
    // Prefer the snapped target from the draft (matches preview),
    // fallback to hitTest if we didn't have a snapped target.
    if (draft && draft.kind === 'connector') {
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
          toAttachment = pickAttachmentForObject(hitObj, pos, fromCenter);
        }
      }

      if (toObj && toAttachment && isConnectable(toObj) && toObj.id !== draft.fromObjectId) {
        const connector: WhiteboardObject = {
          id: draft.id,
          type: 'connector',
          x: 0,
          y: 0,
          strokeColor: draft.strokeColor,
          strokeWidth: draft.strokeWidth,
          from: { objectId: draft.fromObjectId, attachment: draft.fromAttachment },
          to: { objectId: toObj.id, attachment: toAttachment },
          routing: 'straight'
        };

        onCreateObject(connector);
        onSelectionChange([connector.id]);
      }

      setDraft(null);
      releasePointerCaptureSafe(evt);
      return;
    }

    finishInteraction(evt);
  };

  const handlePointerLeave = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    // Cancel connector draft when leaving canvas
    if (draft && draft.kind === 'connector') {
      setDraft(null);
      releasePointerCaptureSafe(evt);
      return;
    }
    finishInteraction(evt);
  };

  return {
    draft,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave
  };
}