// src/whiteboard/tools/line/draw.ts

import type { WhiteboardObject, Viewport } from '../../../domain/types';
import type { DraftShape } from '../../drawing';
import { worldToCanvas } from '../../geometry';

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  tailX: number,
  tailY: number,
  color: string,
  strokeWidthPx: number
): void {
  const dx = tipX - tailX;
  const dy = tipY - tailY;
  const len = Math.hypot(dx, dy);
  if (len <= 0.00001) return;

  const ux = dx / len;
  const uy = dy / len;

  const headLen = Math.max(10, strokeWidthPx * 3);
  const backX = tipX - ux * headLen;
  const backY = tipY - uy * headLen;

  const px = -uy;
  const py = ux;
  const halfWidth = Math.max(4, strokeWidthPx * 1.5);

  const leftX = backX + px * halfWidth;
  const leftY = backY + py * halfWidth;
  const rightX = backX - px * halfWidth;
  const rightY = backY - py * halfWidth;

  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(leftX, leftY);
  ctx.lineTo(rightX, rightY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawLineObject(
  ctx: CanvasRenderingContext2D,
  obj: WhiteboardObject,
  viewport: Viewport
): void {
  if (obj.type !== 'line') return;

  const stroke = obj.strokeColor ?? '#e5e7eb';
  const widthPx = obj.strokeWidth ?? 2;

  const x1 = obj.x;
  const y1 = obj.y;
  const x2 = obj.x2 ?? obj.x;
  const y2 = obj.y2 ?? obj.y;

  const a = worldToCanvas(x1, y1, viewport);
  const b = worldToCanvas(x2, y2, viewport);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = stroke;
  ctx.lineWidth = widthPx;

  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  const arrowStart = Boolean(obj.arrowStart);
  const arrowEnd = Boolean(obj.arrowEnd);

  if (arrowStart) {
    // Tip at A, pointing towards B
    drawArrowHead(ctx, a.x, a.y, b.x, b.y, stroke, widthPx);
  }
  if (arrowEnd) {
    // Tip at B, pointing towards A
    drawArrowHead(ctx, b.x, b.y, a.x, a.y, stroke, widthPx);
  }

  ctx.restore();
}

export function drawLineDraft(
  ctx: CanvasRenderingContext2D,
  draft: DraftShape,
  viewport: Viewport
): void {
  // We reuse the box-draft shape (rectangle kind) for line.
  const d: any = draft as any;
  const startX = d.startX as number | undefined;
  const startY = d.startY as number | undefined;
  const currentX = d.currentX as number | undefined;
  const currentY = d.currentY as number | undefined;
  if (
    typeof startX !== 'number' ||
    typeof startY !== 'number' ||
    typeof currentX !== 'number' ||
    typeof currentY !== 'number'
  ) {
    return;
  }

  const stroke = draft.strokeColor ?? '#e5e7eb';
  const widthPx = Math.max(1, draft.strokeWidth ?? 2);

  const a = worldToCanvas(startX, startY, viewport);
  const b = worldToCanvas(currentX, currentY, viewport);

  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = stroke;
  ctx.lineWidth = widthPx;
  ctx.setLineDash([6, 4]);

  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  // Arrowheads preview (solid)
  ctx.setLineDash([]);
  const arrowStart = Boolean(d.arrowStart);
  const arrowEnd = Boolean(d.arrowEnd);

  if (arrowStart) {
    drawArrowHead(ctx, a.x, a.y, b.x, b.y, stroke, widthPx);
  }
  if (arrowEnd) {
    drawArrowHead(ctx, b.x, b.y, a.x, a.y, stroke, widthPx);
  }

  ctx.restore();
}
