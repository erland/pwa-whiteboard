// src/whiteboard/useCanvasInteractions.ts
import { useState } from 'react';
import type React from 'react';
import type {
  WhiteboardObject,
  Viewport,
  ObjectId,
  Point,
  Attachment,
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
  resolveConnectorEndpoints,
} from './geometry';
import type { DraftShape } from './drawing';
import type { DrawingTool } from './whiteboardTypes';
import { toolPointerDown, toolPointerMove, toolPointerUp } from './tools/interactionsRegistry';
import { pickAttachmentForObject } from './tools/connector/interactions';

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

type DragState = MoveDragState | PanDragState | ResizeDragState | ConnectorEndpointDragState;

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
  canvasHeight,
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

  const toolCtx = {
    objects,
    viewport,
    strokeColor,
    strokeWidth,
    generateObjectId,
  };

  const handlePointerDown = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    // Ignore non-left *mouse* buttons; don't block touch.
    if (evt.pointerType === 'mouse' && evt.button !== 0) return;

    const pos = getCanvasPos(evt); // world coords

    // Drawing tools: delegate "what happens" to tool modules.
    if (activeTool !== 'select') {
      const res = toolPointerDown(activeTool, toolCtx, pos);
      if (res.kind === 'draft') {
        setDraft(res.draft);
        setPointerCaptureSafe(evt);
      } else if (res.kind === 'create') {
        onCreateObject(res.object);
        onSelectionChange(res.selectIds);
      }
      // Even if noop, we don't fall through to select behavior.
      return;
    }

    // Select tool
    const { canvasX, canvasY } = getCanvasXY(evt);

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
          const handleId = hitTestResizeHandleCanvas(canvasX, canvasY, box as Bounds, viewport);
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
                height: box.height,
              },
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

        const endpoint = getConnectorEndpointHit(hitObj, objects, viewport, canvasX, canvasY);

        if (endpoint) {
          setDrag({
            kind: 'connectorEndpoint',
            connectorId: hitObj.id,
            endpoint,
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
        lastY: pos.y,
      });
    } else {
      onSelectionChange([]);
      setDrag({
        kind: 'pan',
        startCanvasX: canvasX,
        startCanvasY: canvasY,
        startOffsetX: viewport.offsetX ?? 0,
        startOffsetY: viewport.offsetY ?? 0,
        zoomAtStart: viewport.zoom ?? 1,
      });
    }

    setPointerCaptureSafe(evt);
  };

  const handlePointerMove = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(evt); // world coords

    // Draft interaction is delegated to tool modules.
    if (draft) {
      const res = toolPointerMove(draft, toolCtx, pos);
      setDraft(res.draft);
      return;
    }

    if (!drag || activeTool !== 'select') return;

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
        drag.endpoint === 'from' ? connector.from?.objectId : connector.to?.objectId;
      const attachedObj = attachedId ? objects.find((o) => o.id === attachedId) : undefined;

      const targetObj = hoverObj ?? (attachedObj && isConnectable(attachedObj) ? attachedObj : null);
      if (!targetObj) return;

      // Allow continuous anchor motion (edgeT/perimeterAngle) while still supporting ports.
      const newAttachment: Attachment = pickAttachmentForObject(targetObj, pos, viewport, otherPoint);

      if (drag.endpoint === 'from') {
        onUpdateObject(connector.id, {
          from: { objectId: targetObj.id, attachment: newAttachment },
        });
      } else {
        onUpdateObject(connector.id, {
          to: { objectId: targetObj.id, attachment: newAttachment },
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
        offsetY: drag.startOffsetY + dyCanvas / zoom,
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
          height: newBounds.height,
        });
      }
    }
  };

  const finishSelectionInteraction = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    setDrag(null);
    releasePointerCaptureSafe(evt);
  };

  const handlePointerUp = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(evt);

    // Draft completion is delegated to tool modules.
    if (draft) {
      const res = toolPointerUp(draft, toolCtx, pos);
      if (res.kind === 'create') {
        onCreateObject(res.object);
        onSelectionChange(res.selectIds);
      }
      setDraft(null);
      releasePointerCaptureSafe(evt);
      return;
    }

    // Selection tool finishing
    finishSelectionInteraction(evt);
  };

  const handlePointerLeave = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(evt);

    // Keep previous behavior:
    // - connector draft: cancel
    // - other drafts: commit
    if (draft) {
      if (draft.kind === 'connector') {
        setDraft(null);
        releasePointerCaptureSafe(evt);
        return;
      }

      const res = toolPointerUp(draft, toolCtx, pos);
      if (res.kind === 'create') {
        onCreateObject(res.object);
        onSelectionChange(res.selectIds);
      }
      setDraft(null);
      releasePointerCaptureSafe(evt);
      return;
    }

    finishSelectionInteraction(evt);
  };

  return {
    draft,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
  };
}
