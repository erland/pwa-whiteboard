// src/whiteboard/tools/rectangle/draw.ts
import type { WhiteboardObject, Viewport } from '../../../domain/types';
import { worldToCanvas } from '../../geometry';

export function drawRectangleObject(
  ctx: CanvasRenderingContext2D,
  obj: WhiteboardObject,
  viewport: Viewport
): void {
  if (obj.type !== 'rectangle') return;

  const stroke = obj.strokeColor ?? '#e5e7eb';
  const widthPx = obj.strokeWidth ?? 2;

  const toCanvas = (x: number, y: number) => worldToCanvas(x, y, viewport);

  const { x, y, width: w = 0, height: h = 0 } = obj;
  const topLeft = toCanvas(x, y);
  const bottomRight = toCanvas(x + w, y + h);
  const drawW = bottomRight.x - topLeft.x;
  const drawH = bottomRight.y - topLeft.y;

  if (obj.fillColor) {
    ctx.fillStyle = obj.fillColor;
    ctx.fillRect(topLeft.x, topLeft.y, drawW, drawH);
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = widthPx;
  ctx.strokeRect(topLeft.x, topLeft.y, drawW, drawH);
}
