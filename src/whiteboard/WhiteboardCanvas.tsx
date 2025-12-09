import React, { useEffect, useRef, useState } from 'react';
import type { WhiteboardObject, Viewport, ObjectId } from '../domain/types';
import {
  getBoundingBox,
  hitTest,
  hitTestResizeHandleCanvas,
  resizeBounds,
  Bounds,
  ResizeHandleId,
  canvasToWorld
} from './geometry';
import {
  DraftShape,
  drawObjectsWithSelection,
  drawDraftShape
} from './drawing';

export type DrawingTool = 'select' | 'freehand' | 'rectangle' | 'ellipse' | 'text' | 'stickyNote';

interface WhiteboardCanvasProps {
  width: number;
  height: number;
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
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}

type ResizeDragState = {
  kind: 'resize';
  objectId: ObjectId;
  handle: ResizeHandleId;
  startX: number; // world coords at pointer-down
  startY: number;
  originalBounds: Bounds;
};

type DragState =
  | {
      kind: 'move';
      objectId: ObjectId;
      lastX: number;
      lastY: number;
    }
  | {
      kind: 'pan';
      startCanvasX: number;
      startCanvasY: number;
      startOffsetX: number;
      startOffsetY: number;
      zoomAtStart: number;
    }
  | ResizeDragState;

function isSelected(id: ObjectId, selectedIds: ObjectId[]): boolean {
  return selectedIds.includes(id);
}

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  width,
  height,
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
  onCanvasReady
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [draft, setDraft] = useState<DraftShape | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  // Notify parent about the canvas element so it can be used for image export.
  useEffect(() => {
    if (onCanvasReady) {
      onCanvasReady(canvasRef.current);
    }
  }, [onCanvasReady]);

  const generateObjectId = () =>
    ('o_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16)) as ObjectId;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // Clear and background
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    // Draw all objects + selection overlays
    drawObjectsWithSelection(ctx, objects, selectedObjectIds, viewport, strokeColor);

    // Draw draft shape on top
    if (draft) {
      drawDraftShape(ctx, draft, viewport);
    }
  }, [objects, selectedObjectIds, draft, viewport, width, height, strokeColor]);

  const getCanvasPos = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = (evt.target as HTMLCanvasElement).getBoundingClientRect();
    const canvasX = evt.clientX - rect.left;
    const canvasY = evt.clientY - rect.top;
    return canvasToWorld(canvasX, canvasY, viewport);
  };

  const handlePointerDown = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    if (evt.button !== 0) return;
    const pos = getCanvasPos(evt); // world coords
    const rect = (evt.target as HTMLCanvasElement).getBoundingClientRect();
    const canvasX = evt.clientX - rect.left;
    const canvasY = evt.clientY - rect.top;

    if (activeTool === 'select') {
      // First: if exactly one object is selected, see if we clicked a resize handle on it
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
                  height: box.height
                }
              });
              (evt.target as HTMLCanvasElement).setPointerCapture(evt.pointerId);
              return;
            }
          }
        }
      }

      // Otherwise, normal selection / move / pan
      const hitObj = hitTest(objects, pos.x, pos.y);
      if (hitObj) {
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
      (evt.target as HTMLCanvasElement).setPointerCapture(evt.pointerId);
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
      (evt.target as HTMLCanvasElement).setPointerCapture(evt.pointerId);
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
      (evt.target as HTMLCanvasElement).setPointerCapture(evt.pointerId);
      return;
    }
  };

  const handlePointerMove = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(evt); // world coords
    const rect = (evt.target as HTMLCanvasElement).getBoundingClientRect();
    const canvasX = evt.clientX - rect.left;
    const canvasY = evt.clientY - rect.top;

    if (draft) {
      setDraft((current) => {
        if (!current) return current;
        if (current.kind === 'freehand') {
          return {
            ...current,
            points: [...current.points, pos]
          };
        }
        return {
          ...current,
          currentX: pos.x,
          currentY: pos.y
        };
      });
      return;
    }

    if (drag && activeTool === 'select') {
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
          y: obj.y + dy
        });
        setDrag({
          ...drag,
          lastX: pos.x,
          lastY: pos.y
        });
      } else if (drag.kind === 'pan') {
        const dxCanvas = canvasX - drag.startCanvasX;
        const dyCanvas = canvasY - drag.startCanvasY;
        const zoom = drag.zoomAtStart || 1;
        const newOffsetX = drag.startOffsetX + dxCanvas / zoom;
        const newOffsetY = drag.startOffsetY + dyCanvas / zoom;
        onViewportChange({
          offsetX: newOffsetX,
          offsetY: newOffsetY
        });
      } else if (drag.kind === 'resize') {
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
            height: newBounds.height
          });
        }
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
        points: draft.points
      };
      onCreateObject(obj);
      onSelectionChange([draft.id]);
      setDraft(null);
      return;
    }

    const { startX, startY, currentX, currentY } = draft;
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
      type: draft.kind === 'rectangle' ? 'rectangle' : 'ellipse',
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
    if (draft) {
      commitDraft();
    }
    setDraft(null);
    setDrag(null);
    try {
      (evt.target as HTMLCanvasElement).releasePointerCapture(evt.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerUp = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    finishInteraction(evt);
  };

  const handlePointerLeave = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    finishInteraction(evt);
  };

  return (
    <canvas
      ref={canvasRef}
      className="whiteboard-canvas"
      style={{ width, height, touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    />
  );
};