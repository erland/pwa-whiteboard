import React, { useEffect, useRef, useState } from 'react';
import type { WhiteboardObject, Viewport, ObjectId, Point } from '../domain/types';

export type DrawingTool = 'select' | 'freehand' | 'rectangle' | 'ellipse';

interface WhiteboardCanvasProps {
  width: number;
  height: number;
  objects: WhiteboardObject[];
  viewport: Viewport;
  activeTool: DrawingTool;
  strokeColor: string;
  strokeWidth: number;
  onCreateObject: (object: WhiteboardObject) => void;
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

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  width,
  height,
  objects,
  viewport,
  activeTool,
  strokeColor,
  strokeWidth,
  onCreateObject
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [draft, setDraft] = useState<DraftShape | null>(null);

  // Simple id generator used only within canvas for new objects
  const generateObjectId = () =>
    ('o_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16)) as ObjectId;

  // Drawing helper
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    // Helper to go from board coords to canvas coords.
    // For now we use a 1:1 mapping and ignore viewport offsets/zoom.
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
      ctx.strokeStyle = stroke;
      ctx.lineWidth = widthPx;
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
        ctx.stroke();
        return;
      }
    };

    objects.forEach(drawObject);

    // Draw draft shape on top
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
  }, [objects, draft, viewport, width, height]);

  const getCanvasPos = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = (evt.target as HTMLCanvasElement).getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    const zoom = viewport.zoom ?? 1;
    const offsetX = viewport.offsetX ?? 0;
    const offsetY = viewport.offsetY ?? 0;

    // Convert back from screen to board coordinates
    return {
      x: x / zoom - offsetX,
      y: y / zoom - offsetY
    };
  };

  const handlePointerDown = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    if (evt.button !== 0) return; // left only
    const pos = getCanvasPos(evt);

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

    // 'select' – not implemented in Step 4
  };

  const handlePointerMove = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draft) return;
    const pos = getCanvasPos(evt);

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

  const handlePointerUp = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    if (draft) {
      commitDraft();
    }
    try {
      (evt.target as HTMLCanvasElement).releasePointerCapture(evt.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerLeave = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    if (draft) {
      commitDraft();
    }
    try {
      (evt.target as HTMLCanvasElement).releasePointerCapture(evt.pointerId);
    } catch {
      // ignore
    }
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
