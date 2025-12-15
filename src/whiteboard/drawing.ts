// src/whiteboard/drawing.ts
import type {WhiteboardObject, Viewport, Point, ObjectId, Attachment, WhiteboardObjectType, ArrowType} from '../domain/types';
import {
  worldToCanvas,
  getBoundingBox,
  getHandlePositions,
  resolveConnectorEndpoints
} from './geometry';
import { getShape } from './tools/shapeRegistry';


export type DraftBase = {
  id: ObjectId;
  strokeColor: string;
  strokeWidth: number;

  // Optional arrowhead settings (used by line and connector tools).
  arrowStart?: ArrowType;
  arrowEnd?: ArrowType;

  /**
   * Optional "owner" tool/object type for this draft.
   *
   * Step D1: Keep DraftShape kinds stable (freehand/rectangle/ellipse/connector),
   * but allow tools to reuse an existing draft kind while still dispatching
   * update/finish logic to the owning tool type.
   *
   * Example future use: a 'diamond' tool could reuse the 'rectangle' draft kind
   * (box-like drag) while setting toolType='diamond' so finishDraft creates a
   * Diamond object.
   */
  toolType?: WhiteboardObjectType;
};

export type DraftShape =
  | (DraftBase & {
      kind: 'freehand';
      points: Point[];
    })
  | (DraftBase & {
      kind: 'rectangle' | 'ellipse';
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
    })
  | (DraftBase & {
      kind: 'connector';
      fromObjectId: ObjectId;
      fromAttachment: Attachment;
      fromPoint: Point; // resolved world point for the start
      currentX: number; // world
      currentY: number; // world
      toObjectId?: ObjectId;
      toAttachment?: Attachment;
      toPoint?: Point;
    });

/**
 * Draw a single whiteboard object.
 */
export function drawObject(
  ctx: CanvasRenderingContext2D,
  obj: WhiteboardObject,
  viewport: Viewport,
  fallbackStrokeColor: string,
  allObjects?: WhiteboardObject[]
): void {
  // Keep shared canvas defaults here; per-tool drawing lives in tool modules.
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Preserve previous behavior: connectors require the full object list to resolve endpoints.
  if (obj.type === 'connector' && !allObjects) return;

  const shape = getShape(obj.type);
  shape.draw(ctx, obj, viewport, {
    objects: allObjects,
    fallbackStrokeColor,
  });

}

function drawConnectorSelection(
  ctx: CanvasRenderingContext2D,
  obj: WhiteboardObject,
  objects: WhiteboardObject[],
  viewport: Viewport
): void {
  const endpoints = resolveConnectorEndpoints(objects, obj);
  if (!endpoints) return;

  const a = worldToCanvas(endpoints.p1.x, endpoints.p1.y, viewport);
  const b = worldToCanvas(endpoints.p2.x, endpoints.p2.y, viewport);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Highlight line
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = Math.max(3, (obj.strokeWidth ?? 2) + 2);
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  // Endpoints
  ctx.setLineDash([]);
  const r = 5;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;

  for (const p of [a, b]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw selection rectangle + resize handles for a given object (if applicable).
 */
export function drawSelectionOutlineAndHandles(
  ctx: CanvasRenderingContext2D,
  obj: WhiteboardObject,
  viewport: Viewport,
  allObjects?: WhiteboardObject[]
): void {
  // Special-case connectors: highlight the line + endpoints (no resize handles).
  if (obj.type === 'connector') {
    if (!allObjects) return;
    drawConnectorSelection(ctx, obj, allObjects, viewport);
    return;
  }

  const bounds = getBoundingBox(obj);
  if (!bounds) return;

  const toCanvas = (x: number, y: number) => worldToCanvas(x, y, viewport);

  const margin = 4;
  const tl = toCanvas(bounds.x - margin, bounds.y - margin);
  const br = toCanvas(
    bounds.x + bounds.width + margin,
    bounds.y + bounds.height + margin
  );
  const wDraw = br.x - tl.x;
  const hDraw = br.y - tl.y;

  // Selection rectangle
  ctx.save();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(tl.x, tl.y, wDraw, hDraw);
  ctx.restore();

  // Resize handles for shapes that support resize.
  // This is registry-driven so the core drawing code does not need to special-case types.
  const shape = getShape(obj.type);
  if (!shape.resize) return;

  const HANDLE_SIZE = 10;
  const handlePositions = getHandlePositions(bounds);

  ctx.save();
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#38bdf8';

  for (const pos of Object.values(handlePositions)) {
    const c = toCanvas(pos.x, pos.y);
    ctx.beginPath();
    ctx.rect(
      c.x - HANDLE_SIZE / 2,
      c.y - HANDLE_SIZE / 2,
      HANDLE_SIZE,
      HANDLE_SIZE
    );
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw all objects + selection overlays.
 */
export function drawObjectsWithSelection(
  ctx: CanvasRenderingContext2D,
  objects: WhiteboardObject[],
  selectedObjectIds: ObjectId[],
  viewport: Viewport,
  fallbackStrokeColor: string
): void {
  for (const obj of objects) {
    drawObject(ctx, obj, viewport, fallbackStrokeColor, objects);
  }

  for (const obj of objects) {
    if (!selectedObjectIds.includes(obj.id)) continue;
    drawSelectionOutlineAndHandles(ctx, obj, viewport, objects);
  }
}

/**
 * Draw the in-progress draft shape (while drawing/dragging).
 */
export function drawDraftShape(
  ctx: CanvasRenderingContext2D,
  draft: DraftShape,
  viewport: Viewport
): void {
  const toCanvas = (x: number, y: number) => worldToCanvas(x, y, viewport);

  ctx.save();
  ctx.globalAlpha = 0.9;

  // NEW: connector draft preview
  if (draft.kind === 'connector') {
    const a = toCanvas(draft.fromPoint.x, draft.fromPoint.y);
    const b = toCanvas(draft.currentX, draft.currentY);

    ctx.strokeStyle = draft.strokeColor;
    ctx.lineWidth = Math.max(1, draft.strokeWidth);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash([6, 4]);

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.restore();
    return;
  }

  if (draft.kind === 'freehand') {
    const pts = draft.points;
    if (pts.length > 1) {
      ctx.strokeStyle = draft.strokeColor;
      ctx.lineWidth = draft.strokeWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      const first = toCanvas(pts[0].x, pts[0].y);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < pts.length; i++) {
        const p = toCanvas(pts[i].x, pts[i].y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  } else {
    const draftType = (draft.toolType ?? draft.kind) as any;
    const shape = getShape(draftType);
    if (shape?.drawDraft) {
      shape.drawDraft(ctx, draft, viewport, { fallbackStrokeColor: draft.strokeColor });
      ctx.restore();
      return;
    }

    const { startX, startY, currentX, currentY } = draft;
    const x1 = Math.min(startX, currentX);
    const y1 = Math.min(startY, currentY);
    const x2 = Math.max(startX, currentX);
    const y2 = Math.max(startY, currentY);
    const tl = toCanvas(x1, y1);
    const br = toCanvas(x2, y2);
    const wDraw = br.x - tl.x;
    const hDraw = br.y - tl.y;

    ctx.strokeStyle = draft.strokeColor;
    ctx.lineWidth = draft.strokeWidth;
    ctx.setLineDash([6, 4]);

    if (draft.kind === 'rectangle') {
      ctx.strokeRect(tl.x, tl.y, wDraw, hDraw);
    } else if (draft.kind === 'ellipse') {
      const cx = tl.x + wDraw / 2;
      const cy = tl.y + hDraw / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(wDraw / 2), Math.abs(hDraw / 2), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
}