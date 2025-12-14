// src/whiteboard/tools/roundedRect/draw.ts
import type { WhiteboardObject, Viewport } from '../../../domain/types';
import { worldToCanvas } from '../../geometry';
import type { DraftShape } from '../../drawing';

/**
 * Draw a rounded rectangle (with optional fill).
 *
 * Note: We use a custom path implementation (arcTo) instead of ctx.roundRect for compatibility.
 */
function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.max(0, Math.min(r, Math.min(Math.abs(w), Math.abs(h)) / 2));

  // Handle degenerate cases
  if (rr <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }

  const x2 = x + w;
  const y2 = y + h;

  ctx.moveTo(x + rr, y);
  ctx.arcTo(x2, y, x2, y2, rr);
  ctx.arcTo(x2, y2, x, y2, rr);
  ctx.arcTo(x, y2, x, y, rr);
  ctx.arcTo(x, y, x2, y, rr);
  ctx.closePath();
}

export function drawRoundedRectObject(
  ctx: CanvasRenderingContext2D,
  obj: WhiteboardObject,
  viewport: Viewport
): void {
  if (obj.type !== 'roundedRect') return;

  const stroke = obj.strokeColor ?? '#e5e7eb';
  const widthPx = obj.strokeWidth ?? 2;

  const toCanvas = (x: number, y: number) => worldToCanvas(x, y, viewport);

  const { x, y, width: w = 0, height: h = 0 } = obj;
  const topLeft = toCanvas(x, y);
  const bottomRight = toCanvas(x + w, y + h);
  const drawW = bottomRight.x - topLeft.x;
  const drawH = bottomRight.y - topLeft.y;

  // Corner radius is stored in world units (same coordinate system as x/y/width/height)
  // Convert to canvas pixels by applying zoom.
  const radiusWorld = typeof obj.cornerRadius === 'number' ? obj.cornerRadius : 12;
  const radiusPx = radiusWorld * viewport.zoom;

  ctx.beginPath();
  roundedRectPath(ctx, topLeft.x, topLeft.y, drawW, drawH, radiusPx);

  if (obj.fillColor) {
    ctx.fillStyle = obj.fillColor;
    ctx.fill();
  }

  ctx.strokeStyle = stroke;
  ctx.lineWidth = widthPx;
  ctx.stroke();
}


/**
 * Draft preview for rounded rect.
 * The draft kind remains 'rectangle' (box drag), but toolType='roundedRect' lets us dispatch here.
 */
export function drawRoundedRectDraft(
  ctx: CanvasRenderingContext2D,
  draft: DraftShape,
  viewport: Viewport
): void {
  if (draft.kind !== 'rectangle') return;

  const { startX, startY, currentX, currentY } = draft;
  const x1 = Math.min(startX, currentX);
  const y1 = Math.min(startY, currentY);
  const x2 = Math.max(startX, currentX);
  const y2 = Math.max(startY, currentY);

  const topLeft = worldToCanvas(x1, y1, viewport);
  const bottomRight = worldToCanvas(x2, y2, viewport);
  const w = bottomRight.x - topLeft.x;
  const h = bottomRight.y - topLeft.y;

  const stroke = draft.strokeColor ?? '#e5e7eb';
  const widthPx = draft.strokeWidth ?? 2;

  const radiusWorld = 12;
  const radiusPx = radiusWorld * viewport.zoom;

  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = widthPx;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  roundedRectPath(ctx, topLeft.x, topLeft.y, w, h, radiusPx);
  ctx.stroke();
  ctx.restore();
}
