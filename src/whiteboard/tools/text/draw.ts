// src/whiteboard/tools/text/draw.ts
import type { WhiteboardObject, Viewport } from '../../../domain/types';
import { worldToCanvas } from '../../geometry';

export function drawTextObject(
  ctx: CanvasRenderingContext2D,
  obj: WhiteboardObject,
  viewport: Viewport,
  fallbackStrokeColor: string
): void {
  if (obj.type !== 'text') return;
  if (!obj.text) return;

  const toCanvas = (x: number, y: number) => worldToCanvas(x, y, viewport);

  const fontSize = obj.fontSize ?? 18;
  const pos = toCanvas(obj.x, obj.y);
  ctx.font = `${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  const textColor = obj.textColor ?? fallbackStrokeColor ?? '#e5e7eb';
  ctx.fillStyle = textColor;
  ctx.fillText(obj.text, pos.x, pos.y);
}
