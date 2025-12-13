// src/whiteboard/tools/stickyNote/draw.ts
import type { WhiteboardObject, Viewport } from '../../../domain/types';
import { worldToCanvas } from '../../geometry';

export function drawStickyNoteObject(
  ctx: CanvasRenderingContext2D,
  obj: WhiteboardObject,
  viewport: Viewport,
  fallbackStrokeColor: string
): void {
  if (obj.type !== 'stickyNote') return;

  const toCanvas = (x: number, y: number) => worldToCanvas(x, y, viewport);

  const { x, y, width: w = 160, height: h = 100 } = obj;
  const topLeft = toCanvas(x, y);
  const bottomRight = toCanvas(x + w, y + h);
  const drawW = bottomRight.x - topLeft.x;
  const drawH = bottomRight.y - topLeft.y;

  const fill = obj.fillColor ?? '#facc15';
  const border = obj.strokeColor ?? '#f59e0b';

  ctx.fillStyle = fill;
  ctx.strokeStyle = border;
  ctx.lineWidth = obj.strokeWidth ?? 1.5;
  ctx.beginPath();
  ctx.rect(topLeft.x, topLeft.y, drawW, drawH);
  ctx.fill();
  ctx.stroke();

  if (obj.text) {
    const fontSize = obj.fontSize ?? 16;
    ctx.font = `${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const textColor = obj.textColor ?? fallbackStrokeColor ?? '#e5e7eb';
    ctx.fillStyle = textColor;
    const padding = 8;
    const textPos = toCanvas(x + padding, y + padding);
    ctx.fillText(obj.text, textPos.x, textPos.y, drawW - padding * 2);
  }
}
