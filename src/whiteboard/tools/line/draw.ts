// src/whiteboard/tools/line/draw.ts

import type { WhiteboardObject, Viewport, ArrowType } from '../../../domain/types';
import type { DraftShape } from '../../drawing';
import { worldToCanvas } from '../../geometry';
import { drawArrowHead } from '../_shared/arrowHeads';

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
  const arrowStart = ((d as any).arrowStart ?? 'none') as ArrowType;
  const arrowEnd = ((d as any).arrowEnd ?? 'none') as ArrowType;

  if (arrowStart !== 'none') {
    drawArrowHead(ctx, a.x, a.y, b.x, b.y, arrowStart, stroke, widthPx);
  }
  if (arrowEnd !== 'none') {
    drawArrowHead(ctx, b.x, b.y, a.x, a.y, arrowEnd, stroke, widthPx);
  }

  ctx.restore();
}
