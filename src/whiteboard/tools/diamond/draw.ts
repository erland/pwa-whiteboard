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


/**
 * Draft preview for diamond while dragging.
 * Uses the same inscribed-rhombus geometry as the committed diamond object,
 * but with dashed stroke (to match other drafts).
 */
export function drawDiamondDraft(
  ctx: CanvasRenderingContext2D,
  draft: import('../../drawing').DraftShape,
  viewport: Viewport
): void {
  // Drafts for diamond are produced as box-drafts (start/current) with toolType='diamond'
  if (draft.kind !== 'rectangle' && draft.kind !== 'ellipse' && (draft as any).startX === undefined) return;

  const anyDraft = draft as any;
  const startX: number = anyDraft.startX;
  const startY: number = anyDraft.startY;
  const currentX: number = anyDraft.currentX;
  const currentY: number = anyDraft.currentY;

  const x1 = Math.min(startX, currentX);
  const y1 = Math.min(startY, currentY);
  const x2 = Math.max(startX, currentX);
  const y2 = Math.max(startY, currentY);

  const toCanvas = (x: number, y: number) => worldToCanvas(x, y, viewport);

  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;

  const top = toCanvas(cx, y1);
  const right = toCanvas(x2, cy);
  const bottom = toCanvas(cx, y2);
  const left = toCanvas(x1, cy);

  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = (draft as any).strokeColor ?? '#e5e7eb';
  ctx.lineWidth = (draft as any).strokeWidth ?? 2;
  ctx.setLineDash([6, 4]);

  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(right.x, right.y);
  ctx.lineTo(bottom.x, bottom.y);
  ctx.lineTo(left.x, left.y);
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
}
