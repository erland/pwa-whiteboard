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
  hitTest, hitTestConnectable,
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
import { toolPointerDown, toolPointerMove, toolPointerUp, translateObject, canResizeObject, resizeObject } from './tools/shapeRegistry';
import { pickAttachmentForObject } from './tools/connector/interactions';

type ResizeDragState = {
  kind: 'resize';
  objectId: ObjectId;
  handle: ResizeHandleId;
  startX: number; // world coords at pointer-down
  startY: number;
  originalBounds: Bounds;
  originalObject: WhiteboardObject;
  lastPatch?: Partial<WhiteboardObject> | null;
};

type MoveDragState = {
  kind: 'move';
  objectId: ObjectId;
  startX: number; // world coords at pointer-down
  startY: number;
  originalObject: WhiteboardObject;
  lastPatch?: Partial<WhiteboardObject> | null;
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
  originalObject: WhiteboardObject;
  lastPatch?: Partial<WhiteboardObject> | null;
};

type LineEndpointDragState = {
  kind: 'lineEndpoint';
  lineId: ObjectId;
  endpoint: 'start' | 'end';
  originalObject: WhiteboardObject;
  lastPatch?: Partial<WhiteboardObject> | null;
};

type DragState =
  | MoveDragState
  | PanDragState
  | ResizeDragState
  | ConnectorEndpointDragState
  | LineEndpointDragState
function cloneObj<T>(obj: T): T {
  // Whiteboard objects are plain JSON-serializable data.
  try {
    // @ts-ignore
    if (typeof structuredClone === 'function') return structuredClone(obj);
  } catch {
    // ignore
  }
  return JSON.parse(JSON.stringify(obj)) as T;
}

function isDeepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  const ta = typeof a;
  const tb = typeof b;
  if (ta !== tb) return false;
  if (a && b && ta === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

function minimizePatch(original: any, patch: Record<string, any>): Record<string, any> | null {
  const out: any = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!isDeepEqual(original?.[k], v)) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

;


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

function getLineEndpointHit(
  line: WhiteboardObject,
  viewport: Viewport,
  pointerCanvasX: number,
  pointerCanvasY: number
): 'start' | 'end' | null {
  if (line.type !== 'line') return null;

  const a = worldToCanvas(line.x, line.y, viewport);
  const b = worldToCanvas(line.x2 ?? line.x, line.y2 ?? line.y, viewport);

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
  if (hitA && !hitB) return 'start';
  if (!hitA && hitB) return 'end';

  // Both: pick the closest.
  return dA2 <= dB2 ? 'start' : 'end';
}

export type CanvasInteractionsParams = {
  objects: WhiteboardObject[];
  selectedObjectIds: ObjectId[];
  viewport: Viewport;
  activeTool: DrawingTool;
  strokeColor: string;
  strokeWidth: number;
  toolProps?: Partial<WhiteboardObject>;
  onCreateObject: (object: WhiteboardObject) => void;
  onSelectionChange: (selectedIds: ObjectId[]) => void;
  onUpdateObject: (objectId: ObjectId, patch: Partial<WhiteboardObject>) => void;
  /** Live interaction patch (drag/resize) that should NOT create an undo step. */
  onTransientObjectPatch: (objectId: ObjectId, patch: Partial<WhiteboardObject>) => void;
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
  toolProps,
  onCreateObject,
  onSelectionChange,
  onUpdateObject,
  onTransientObjectPatch,
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
    toolProps,
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

      // Resize is registry-driven: only shapes that implement resize() are resizable.
      if (selectedObj && canResizeObject(selectedObj)) {
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
              originalObject: cloneObj(selectedObj),
              lastPatch: null,
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
      // Straight lines: show endpoint anchors and allow dragging endpoints (no resize handles).
      if (hitObj.type === 'line') {
        onSelectionChange([hitObj.id]);

        const endpoint = getLineEndpointHit(hitObj, viewport, canvasX, canvasY);
        if (endpoint) {
          setDrag({
            kind: 'lineEndpoint',
            lineId: hitObj.id,
            endpoint,
            originalObject: cloneObj(hitObj),
            lastPatch: null,
          });
          setPointerCaptureSafe(evt);
          return;
        }

        // Clicked the line body, not an endpoint: move the whole line.
        setDrag({
          kind: 'move',
          objectId: hitObj.id,
          startX: pos.x,
          startY: pos.y,
          originalObject: cloneObj(hitObj),
          lastPatch: null,
        });
        setPointerCaptureSafe(evt);
        return;
      }

      // Special-case connectors: allow dragging endpoints to retarget / move anchors.
      if (hitObj.type === 'connector') {
        onSelectionChange([hitObj.id]);

        const endpoint = getConnectorEndpointHit(hitObj, objects, viewport, canvasX, canvasY);

        if (endpoint) {
          setDrag({
            kind: 'connectorEndpoint',
            connectorId: hitObj.id,
            endpoint,
            originalObject: cloneObj(hitObj),
            lastPatch: null,
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
        startX: pos.x,
        startY: pos.y,
        originalObject: cloneObj(hitObj),
        lastPatch: null,
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

    if (drag.kind === 'lineEndpoint') {
      const line = objects.find((o) => o.id === drag.lineId);
      if (!line || line.type !== 'line') return;

      const patch =
        drag.endpoint === 'start'
          ? ({ x: pos.x, y: pos.y } as Partial<WhiteboardObject>)
          : ({ x2: pos.x, y2: pos.y } as Partial<WhiteboardObject>);

      onTransientObjectPatch(line.id, patch);
      setDrag({ ...drag, lastPatch: patch });
      return;
    }

    if (drag.kind === 'connectorEndpoint') {
      const connector = objects.find((o) => o.id === drag.connectorId);
      if (!connector || connector.type !== 'connector') return;

      // Prefer re-attaching to the connectable object currently under pointer.
      const hoverObj = hitTestConnectable(objects, pos.x, pos.y);

      // Otherwise, move along the currently attached object (if still present).
      const attachedId =
        drag.endpoint === 'from' ? connector.from?.objectId : connector.to?.objectId;
      const attachedObj = attachedId ? objects.find((o) => o.id === attachedId) : undefined;

      const targetObj = hoverObj ?? (attachedObj && isConnectable(attachedObj) ? attachedObj : null);
      if (!targetObj) return;

      // Allow continuous anchor motion (edgeT/perimeterAngle) while still supporting ports.
      const newAttachment: Attachment = pickAttachmentForObject(targetObj, pos, viewport);

      const patch =
        drag.endpoint === 'from'
          ? ({ from: { objectId: targetObj.id, attachment: newAttachment } } as Partial<WhiteboardObject>)
          : ({ to: { objectId: targetObj.id, attachment: newAttachment } } as Partial<WhiteboardObject>);

      onTransientObjectPatch(connector.id, patch);
      setDrag({ ...drag, lastPatch: patch });
      return;
    }

    if (drag.kind === 'move') {
      const dx = pos.x - drag.startX;
      const dy = pos.y - drag.startY;
      if (dx === 0 && dy === 0) return;

      const patch = translateObject(drag.originalObject, dx, dy);

      // If a shape opts out of moving (e.g., semantic connectors), don't emit patches.
      if (!patch) return;

      onTransientObjectPatch(drag.objectId, patch);
      setDrag({ ...drag, lastPatch: patch });
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

      const patch = resizeObject(drag.originalObject, newBounds);
      if (patch) {
        onTransientObjectPatch(drag.objectId, patch);
        setDrag({ ...drag, lastPatch: patch });
      }
    }
  };

  const finishSelectionInteraction = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    if (drag && activeTool === 'select') {
      if (drag.kind === 'move') {
        const patch = drag.lastPatch ?? null;
        const minimized = patch ? minimizePatch(drag.originalObject, patch as any) : null;
        if (minimized) onUpdateObject(drag.objectId, minimized as any);
      } else if (drag.kind === 'resize') {
        const patch = drag.lastPatch ?? null;
        const minimized = patch ? minimizePatch(drag.originalObject, patch as any) : null;
        if (minimized) onUpdateObject(drag.objectId, minimized as any);
      } else if (drag.kind === 'lineEndpoint') {
        const patch = drag.lastPatch ?? null;
        const minimized = patch ? minimizePatch(drag.originalObject, patch as any) : null;
        if (minimized) onUpdateObject(drag.lineId, minimized as any);
      } else if (drag.kind === 'connectorEndpoint') {
        const patch = drag.lastPatch ?? null;
        const minimized = patch ? minimizePatch(drag.originalObject, patch as any) : null;
        if (minimized) onUpdateObject(drag.connectorId, minimized as any);
      }
    }

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