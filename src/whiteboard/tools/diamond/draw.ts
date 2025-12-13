// src/whiteboard/tools/diamond/draw.ts
import type { WhiteboardObject, Viewport } from '../../../domain/types';
import { worldToCanvas } from '../../geometry';

/**
 * Diamond is a rhombus inscribed in the object's bounding box:
 * vertices at midpoints of each side of the box.
 *
 * (x,y,w,h) define the bounding box in world coordinates.
 */
export function drawDiamondObject(
  ctx: CanvasRenderingContext2D,
  obj: WhiteboardObject,
  viewport: Viewport
): void {
  if (obj.type !== 'diamond') return;

  const stroke = obj.strokeColor ?? '#e5e7eb';
  const widthPx = obj.strokeWidth ?? 2;

  const { x, y, width: w = 0, height: h = 0 } = obj;
  if (w === 0 || h === 0) return;

  const cx = x + w / 2;
  const cy = y + h / 2;

  const top = worldToCanvas(cx, y, viewport);
  const right = worldToCanvas(x + w, cy, viewport);
  const bottom = worldToCanvas(cx, y + h, viewport);
  const left = worldToCanvas(x, cy, viewport);

  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(right.x, right.y);
  ctx.lineTo(bottom.x, bottom.y);
  ctx.lineTo(left.x, left.y);
  ctx.closePath();

  if (obj.fillColor) {
    ctx.fillStyle = obj.fillColor;
    ctx.fill();
  }

  ctx.strokeStyle = stroke;
  ctx.lineWidth = widthPx;
  ctx.stroke();
}
