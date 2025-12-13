// src/whiteboard/tools/ellipse/draw.ts
import type { WhiteboardObject, Viewport } from '../../../domain/types';
import { worldToCanvas } from '../../geometry';

export function drawEllipseObject(
  ctx: CanvasRenderingContext2D,
  obj: WhiteboardObject,
  viewport: Viewport
): void {
  if (obj.type !== 'ellipse') return;

  const stroke = obj.strokeColor ?? '#e5e7eb';
  const widthPx = obj.strokeWidth ?? 2;

  const toCanvas = (x: number, y: number) => worldToCanvas(x, y, viewport);

  const { x, y, width: w = 0, height: h = 0 } = obj;
  const center = toCanvas(x + w / 2, y + h / 2);
  const zoom = viewport.zoom ?? 1;
  const radiusX = (w / 2) * zoom;
  const radiusY = (h / 2) * zoom;

  ctx.beginPath();
  ctx.ellipse(center.x, center.y, Math.abs(radiusX), Math.abs(radiusY), 0, 0, Math.PI * 2);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = widthPx;
  ctx.stroke();
}
