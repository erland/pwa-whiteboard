// src/whiteboard/tools/connector/draw.ts
import type { WhiteboardObject, Viewport, ArrowType } from '../../../domain/types';
import { worldToCanvas, resolveConnectorEndpoints } from '../../geometry';
import { drawArrowHead } from '../_shared/arrowHeads';

export function drawConnectorObject(
  ctx: CanvasRenderingContext2D,
  obj: WhiteboardObject,
  objects: WhiteboardObject[],
  viewport: Viewport
): void {
  if (obj.type !== 'connector') return;

  const endpoints = resolveConnectorEndpoints(objects, obj);
  if (!endpoints) return;

  const stroke = obj.strokeColor ?? '#e5e7eb';
  const widthPx = obj.strokeWidth ?? 2;

  const a = worldToCanvas(endpoints.p1.x, endpoints.p1.y, viewport);
  const b = worldToCanvas(endpoints.p2.x, endpoints.p2.y, viewport);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = stroke;
  ctx.lineWidth = widthPx;

  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  const arrowStart = (obj.arrowStart ?? 'none') as ArrowType;
  const arrowEnd = (obj.arrowEnd ?? 'none') as ArrowType;

  if (arrowStart !== 'none') {
    // Tip at A, pointing towards B
    drawArrowHead(ctx, a.x, a.y, b.x, b.y, arrowStart, stroke, widthPx);
  }
  if (arrowEnd !== 'none') {
    // Tip at B, pointing towards A
    drawArrowHead(ctx, b.x, b.y, a.x, a.y, arrowEnd, stroke, widthPx);
  }

  ctx.restore();
}
