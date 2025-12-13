// src/whiteboard/tools/freehand/draw.ts
import type { WhiteboardObject, Viewport } from '../../../domain/types';
import { worldToCanvas } from '../../geometry';

export function drawFreehandObject(
  ctx: CanvasRenderingContext2D,
  obj: WhiteboardObject,
  viewport: Viewport
): void {
  if (obj.type !== 'freehand') return;
  if (!obj.points || obj.points.length <= 1) return;

  const stroke = obj.strokeColor ?? '#e5e7eb';
  const widthPx = obj.strokeWidth ?? 2;

  const toCanvas = (x: number, y: number) => worldToCanvas(x, y, viewport);

  const pts = obj.points;
  ctx.beginPath();
  const first = toCanvas(pts[0].x, pts[0].y);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < pts.length; i++) {
    const p = toCanvas(pts[i].x, pts[i].y);
    ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = widthPx;
  ctx.stroke();
}
