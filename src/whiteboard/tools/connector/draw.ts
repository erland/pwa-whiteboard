// src/whiteboard/tools/connector/draw.ts
import type { WhiteboardObject, Viewport } from '../../../domain/types';
import { worldToCanvas, resolveConnectorEndpoints } from '../../geometry';

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

  ctx.restore();
}
