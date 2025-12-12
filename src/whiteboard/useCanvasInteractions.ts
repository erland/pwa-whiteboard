// src/whiteboard/useCanvasInteractions.ts
import { useState } from 'react';
import type React from 'react';
import type { WhiteboardObject, Viewport, ObjectId } from '../domain/types';
import {
  getBoundingBox,
  hitTest,
  hitTestResizeHandleCanvas,
  resizeBounds,
  Bounds,
  ResizeHandleId,
  canvasToWorld,
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

type DragState = MoveDragState | PanDragState | ResizeDragState;

function isSelected(id: ObjectId, selectedIds: ObjectId[]): boolean {
  return selectedIds.includes(id);
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

  // NEW: logical canvas size (same as the props.width / props.height)
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
    ('o_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16)) as ObjectId;

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
    const canvas = evt.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width || 1;
    const scaleY = canvasHeight / rect.height || 1;
    const canvasX = (evt.clientX - rect.left) * scaleX;
    const canvasY = (evt.clientY - rect.top) * scaleY;

    if (activeTool === 'select') {
      // 1) Resize if exactly one object selected and we hit a handle
      if (selectedObjectIds.length === 1) {
        const selectedId = selectedObjectIds[0];
        const selectedObj = objects.find((o) => o.id === selectedId);
        if (selectedObj && selectedObj.type !== 'freehand') {
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
        text: 'Text',
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
        text: 'Sticky note',
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
        points: [pos],
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
        currentY: pos.y,
      });
      setPointerCaptureSafe(evt);
      return;
    }
  };

  const handlePointerMove = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(evt); // world coords
    const canvas = evt.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width || 1;
    const scaleY = canvasHeight / rect.height || 1;
    const canvasX = (evt.clientX - rect.left) * scaleX;
    const canvasY = (evt.clientY - rect.top) * scaleY;

    // Update draft (drawing in progress)
    if (draft) {
      setDraft((current) => {
        if (!current) return current;
        if (current.kind === 'freehand') {
          return {
            ...current,
            points: [...current.points, pos],
          };
        }
        return {
          ...current,
          currentX: pos.x,
          currentY: pos.y,
        };
      });
      return;
    }

    if (!drag || activeTool !== 'select') {
      return;
    }

    if (drag.kind === 'move') {
      const dx = pos.x - drag.lastX;
      const dy = pos.y - drag.lastY;
      if (dx === 0 && dy === 0) {
        return;
      }

      const obj = objects.find((o) => o.id === drag.objectId);
      if (!obj) {
        return;
      }

      onUpdateObject(obj.id, {
        x: obj.x + dx,
        y: obj.y + dy,
      });

      setDrag({
        ...drag,
        lastX: pos.x,
        lastY: pos.y,
      });
      return;
    }

    if (drag.kind === 'pan') {
      const dxCanvas = canvasX - drag.startCanvasX;
      const dyCanvas = canvasY - drag.startCanvasY;
      const zoom = drag.zoomAtStart || 1;

      const newOffsetX = drag.startOffsetX + dxCanvas / zoom;
      const newOffsetY = drag.startOffsetY + dyCanvas / zoom;

      onViewportChange({
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      });
      return;
    }

    if (drag.kind === 'resize') {
      const dx = pos.x - drag.startX;
      const dy = pos.y - drag.startY;
      const newBounds = resizeBounds(drag.originalBounds, drag.handle, dx, dy);

      const obj = objects.find((o) => o.id === drag.objectId);
      if (!obj) {
        return;
      }

      // Only resize objects that actually have x/y/width/height
      if (obj.type !== 'freehand') {
        onUpdateObject(drag.objectId, {
          x: newBounds.x,
          y: newBounds.y,
          width: newBounds.width,
          height: newBounds.height,
        });
      }
    }
  };

  const commitDraft = () => {
    if (!draft) return;

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
        points: draft.points,
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
      strokeWidth,
    };

    onCreateObject(obj);
    onSelectionChange([draft.id]);
    setDraft(null);
  };

  const finishInteraction = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    if (draft) {
      commitDraft();
    }

    setDraft(null);
    setDrag(null);
    releasePointerCaptureSafe(evt);
  };

  const handlePointerUp = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    finishInteraction(evt);
  };

  const handlePointerLeave = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    finishInteraction(evt);
  };

  return {
    draft,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
  };
}