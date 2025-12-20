// src/whiteboard/useCanvasInteractions.ts
import { useState } from 'react';
import type React from 'react';
import type {
  WhiteboardObject,
  Viewport,
  ObjectId,
  Point,
} from '../domain/types';
import {
  getBoundingBox,
  hitTest,
  hitTestResizeHandleCanvas,
  Bounds,
  worldToCanvas,
  canvasToWorld,
  resolveConnectorEndpoints,
} from './geometry';
import type { DraftShape } from './drawing';
import type { DrawingTool } from './whiteboardTypes';
import { toolPointerDown, toolPointerMove, toolPointerUp, canResizeObject } from './tools/shapeRegistry';

import type { DragState } from './interactions/drag/types';
import { handleDragMove, getCommitFromDrag } from './interactions/drag/dispatch';

// DragState definitions moved to src/whiteboard/interactions/drag/types.ts
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
  onCursorWorldMove?: (pos: { x: number; y: number }) => void;
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
  onCursorWorldMove,
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

    const pos = getCanvasPos(evt);
    onCursorWorldMove?.(pos);


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
            objectId: hitObj.id,
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
            objectId: hitObj.id,
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
    const pos = getCanvasPos(evt);
    onCursorWorldMove?.(pos);


    // Draft interaction is delegated to tool modules.
    if (draft) {
      const res = toolPointerMove(draft, toolCtx, pos);
      setDraft(res.draft);
      return;
    }

    if (!drag || activeTool !== 'select') return;

    const { canvasX, canvasY } = getCanvasXY(evt);

    const next = handleDragMove(drag, {
      objects,
      viewport,
      pos,
      canvasX,
      canvasY,
      onTransientObjectPatch,
      onViewportChange,
    });

    // Avoid unnecessary state updates for pan, no-op moves, etc.
    if (next !== drag) setDrag(next);
  };

  const finishSelectionInteraction = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    if (drag && activeTool === 'select') {
      const commit = getCommitFromDrag(drag, minimizePatch);
      if (commit) onUpdateObject(commit.objectId, commit.patch);
    }

    setDrag(null);
    releasePointerCaptureSafe(evt);
  };

  const handlePointerUp = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(evt);
    onCursorWorldMove?.(pos);

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
    onCursorWorldMove?.(pos);


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