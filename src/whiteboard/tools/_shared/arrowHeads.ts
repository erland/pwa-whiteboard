// src/whiteboard/tools/_shared/arrowHeads.ts

import type { ArrowType } from '../../../domain/types';

/**
 * Draw an arrow head at `tip` pointing towards `tail`.
 *
 * - open: stroked V
 * - closed: outlined triangle
 * - filled: filled triangle
 */
export function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  tailX: number,
  tailY: number,
  arrowType: ArrowType,
  color: string,
  strokeWidthPx: number
): void {
  const dx = tipX - tailX;
  const dy = tipY - tailY;
  const len = Math.hypot(dx, dy);
  if (len <= 0.00001) return;

  const ux = dx / len;
  const uy = dy / len;

  // Arrow size (in canvas pixels). Keep proportional to stroke width, with a minimum.
  // Requested: make arrows ~2x larger than previous.
  const headLen = Math.max(20, strokeWidthPx * 6);
  const backX = tipX - ux * headLen;
  const backY = tipY - uy * headLen;

  const px = -uy;
  const py = ux;
  const halfWidth = Math.max(8, strokeWidthPx * 3);

  const leftX = backX + px * halfWidth;
  const leftY = backY + py * halfWidth;
  const rightX = backX - px * halfWidth;
  const rightY = backY - py * halfWidth;

  if (arrowType === 'open') {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidthPx;
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(leftX, leftY);
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(rightX, rightY);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (arrowType === 'closed') {
    // Outlined triangle
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidthPx;
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (arrowType === 'filled') {
    // Filled triangle (legacy)
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
}
