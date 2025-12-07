import React, { useEffect, useRef, useState } from 'react';
import type { WhiteboardObject, Viewport, ObjectId, Point } from '../domain/types';

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

type DraftShape =
  | {
      kind: 'freehand';
      id: ObjectId;
      strokeColor: string;
      strokeWidth: number;
      points: Point[];
    }
  | {
      kind: 'rectangle' | 'ellipse';
      id: ObjectId;
      strokeColor: string;
      strokeWidth: number;
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
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
    };

function isSelected(id: ObjectId, selectedIds: ObjectId[]): boolean {
  return selectedIds.includes(id);
}

function getBoundingBox(obj: WhiteboardObject): { x: number; y: number; width: number; height: number } | null {
  if (typeof obj.x !== 'number' || typeof obj.y !== 'number') {
    return null;
  }
  const width = obj.width ?? 0;
  const height = obj.height ?? 0;

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

function hitTest(objects: WhiteboardObject[], x: number, y: number): WhiteboardObject | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
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

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    const worldToCanvas = (x: number, y: number) => {
      const zoom = viewport.zoom ?? 1;
      const offsetX = viewport.offsetX ?? 0;
      const offsetY = viewport.offsetY ?? 0;
      return {
        x: (x + offsetX) * zoom,
        y: (y + offsetY) * zoom
      };
    };

    const drawObject = (obj: WhiteboardObject) => {
      const stroke = obj.strokeColor ?? '#e5e7eb';
      const widthPx = obj.strokeWidth ?? 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      if (obj.type === 'freehand' && obj.points && obj.points.length > 1) {
        const pts = obj.points;
        ctx.beginPath();
        const first = worldToCanvas(pts[0].x, pts[0].y);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < pts.length; i++) {
          const p = worldToCanvas(pts[i].x, pts[i].y);
          ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = stroke;
        ctx.lineWidth = widthPx;
        ctx.stroke();
        return;
      }

      if (obj.type === 'rectangle') {
        const { x, y, width: w = 0, height: h = 0 } = obj;
        const topLeft = worldToCanvas(x, y);
        const bottomRight = worldToCanvas(x + w, y + h);
        const drawW = bottomRight.x - topLeft.x;
        const drawH = bottomRight.y - topLeft.y;

        if (obj.fillColor) {
          ctx.fillStyle = obj.fillColor;
          ctx.fillRect(topLeft.x, topLeft.y, drawW, drawH);
        }
        ctx.strokeStyle = stroke;
        ctx.lineWidth = widthPx;
        ctx.strokeRect(topLeft.x, topLeft.y, drawW, drawH);
        return;
      }

      if (obj.type === 'ellipse') {
        const { x, y, width: w = 0, height: h = 0 } = obj;
        const center = worldToCanvas(x + w / 2, y + h / 2);
        const radiusX = (w / 2) * (viewport.zoom ?? 1);
        const radiusY = (h / 2) * (viewport.zoom ?? 1);
        ctx.beginPath();
        ctx.ellipse(center.x, center.y, Math.abs(radiusX), Math.abs(radiusY), 0, 0, Math.PI * 2);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = widthPx;
        ctx.stroke();
        return;
      }

      if (obj.type === 'stickyNote') {
        const { x, y, width: w = 160, height: h = 100 } = obj;
        const topLeft = worldToCanvas(x, y);
        const bottomRight = worldToCanvas(x + w, y + h);
        const drawW = bottomRight.x - topLeft.x;
        const drawH = bottomRight.y - topLeft.y;

        const fill = obj.fillColor ?? '#facc15';
        const border = obj.strokeColor ?? '#f59e0b';

        ctx.fillStyle = fill;
        ctx.strokeStyle = border;
        ctx.lineWidth = obj.strokeWidth ?? 1.5;
        ctx.beginPath();
        ctx.rect(topLeft.x, topLeft.y, drawW, drawH);
        ctx.fill();
        ctx.stroke();

        if (obj.text) {
          const fontSize = obj.fontSize ?? 16;
          ctx.font = `${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
          ctx.textBaseline = 'top';
          ctx.textAlign = 'left';
          ctx.fillStyle = '#020617';
          const padding = 8;
          const textPos = worldToCanvas(x + padding, y + padding);
          ctx.fillText(obj.text, textPos.x, textPos.y, drawW - padding * 2);
        }
        return;
      }

      if (obj.type === 'text') {
        if (!obj.text) return;
        const fontSize = obj.fontSize ?? 18;
        const pos = worldToCanvas(obj.x, obj.y);
        ctx.font = `${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillStyle = stroke;
        ctx.fillText(obj.text, pos.x, pos.y);
        return;
      }
    };

    objects.forEach((obj) => {
      drawObject(obj);

      if (isSelected(obj.id, selectedObjectIds)) {
        const box = getBoundingBox(obj);
        if (box) {
          const margin = 4;
          const tl = worldToCanvas(box.x - margin, box.y - margin);
          const br = worldToCanvas(box.x + box.width + margin, box.y + box.height + margin);
          const wDraw = br.x - tl.x;
          const hDraw = br.y - tl.y;

          ctx.save();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(tl.x, tl.y, wDraw, hDraw);
          ctx.restore();
        }
      }
    });

    if (draft) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      if (draft.kind === 'freehand') {
        const pts = draft.points;
        if (pts.length > 1) {
          ctx.strokeStyle = draft.strokeColor;
          ctx.lineWidth = draft.strokeWidth;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.beginPath();
          const first = worldToCanvas(pts[0].x, pts[0].y);
          ctx.moveTo(first.x, first.y);
          for (let i = 1; i < pts.length; i++) {
            const p = worldToCanvas(pts[i].x, pts[i].y);
            ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
        }
      } else {
        const { startX, startY, currentX, currentY } = draft;
        const x1 = Math.min(startX, currentX);
        const y1 = Math.min(startY, currentY);
        const x2 = Math.max(startX, currentX);
        const y2 = Math.max(startY, currentY);
        const tl = worldToCanvas(x1, y1);
        const br = worldToCanvas(x2, y2);
        const wDraw = br.x - tl.x;
        const hDraw = br.y - tl.y;

        ctx.strokeStyle = draft.strokeColor;
        ctx.lineWidth = draft.strokeWidth;
        ctx.setLineDash([6, 4]);

        if (draft.kind === 'rectangle') {
          ctx.strokeRect(tl.x, tl.y, wDraw, hDraw);
        } else if (draft.kind === 'ellipse') {
          const cx = tl.x + wDraw / 2;
          const cy = tl.y + hDraw / 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, Math.abs(wDraw / 2), Math.abs(hDraw / 2), 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }, [objects, selectedObjectIds, draft, viewport, width, height]);

  const getCanvasPos = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = (evt.target as HTMLCanvasElement).getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    const zoom = viewport.zoom ?? 1;
    const offsetX = viewport.offsetX ?? 0;
    const offsetY = viewport.offsetY ?? 0;

    return {
      x: x / zoom - offsetX,
      y: y / zoom - offsetY
    };
  };

  const handlePointerDown = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    if (evt.button !== 0) return;
    const pos = getCanvasPos(evt);
    const rect = (evt.target as HTMLCanvasElement).getBoundingClientRect();
    const canvasX = evt.clientX - rect.left;
    const canvasY = evt.clientY - rect.top;

    if (activeTool === 'select') {
      const hit = hitTest(objects, pos.x, pos.y);
      if (hit) {
        onSelectionChange([hit.id]);
        setDrag({
          kind: 'move',
          objectId: hit.id,
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
    const pos = getCanvasPos(evt);
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
