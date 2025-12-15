// src/whiteboard/tools/shapeRegistry.ts

/**
 * Step A2/C3: Aggregate per-tool definitions in a single registry and expose
 * tool interaction dispatch from here.
 *
 * Notes:
 * - The SHAPES registry aggregates draw/geometry/ports/selection/draft lifecycle
 *   for each object/tool type.
 * - Step C3: useCanvasInteractions should import toolPointerDown/Move/Up from
 *   this module (not a separate interactionsRegistry).
 */

import type { WhiteboardObject, WhiteboardObjectType, Point, ObjectId, Viewport } from '../../domain/types';
import type { ShapeToolDefinition, ToolPointerContext, ToolCreateResult } from './shapeTypes';
import type { Bounds } from '../geometry/types';
import type { ObjectPort } from './shapeTypes';
import type { SelectionCapabilities } from './selection/types';
import type { DraftShape } from '../drawing';
import type { DrawingTool } from '../whiteboardTypes';

/* ===== draw ===== */
import { drawFreehandObject } from './freehand/draw';
import { drawLineObject, drawLineDraft } from './line/draw';
import { drawRectangleObject } from './rectangle/draw';
import { drawRoundedRectObject, drawRoundedRectDraft } from './roundedRect/draw';
import { drawEllipseObject } from './ellipse/draw';
import { drawDiamondObject, drawDiamondDraft } from './diamond/draw';
import { drawTextObject } from './text/draw';
import { drawStickyNoteObject } from './stickyNote/draw';
import { drawConnectorObject } from './connector/draw';

/* ===== geometry / ports ===== */
import { getFreehandBoundingBox, translateFreehandObject, resizeFreehandObject } from './freehand/geometry';
import { getLineBoundingBox, hitTestLine, translateLineObject, resizeLineObject } from './line/geometry';
import { getRectangleBoundingBox, getRectanglePorts } from './rectangle/geometry';
import { getRoundedRectBoundingBox, getRoundedRectPorts } from './roundedRect/geometry';
import { getEllipseBoundingBox, getEllipsePorts } from './ellipse/geometry';
import { getDiamondBoundingBox, getDiamondPorts, hitTestDiamond } from './diamond/geometry';
import { getTextBoundingBox, getTextPorts } from './text/geometry';
import { getStickyNoteBoundingBox, getStickyNotePorts } from './stickyNote/geometry';
import { getConnectorBoundingBox, hitTestConnector } from './connector/geometry';
import { resizeBoxObjectByBounds } from './_shared/resizeByBounds';

/* ===== selection capabilities ===== */
import { rectangleSelectionCapabilities } from './rectangle/selection';
import { roundedRectSelectionCapabilities } from './roundedRect/selection';
import { ellipseSelectionCapabilities } from './ellipse/selection';
import { diamondSelectionCapabilities } from './diamond/selection';
import { freehandSelectionCapabilities } from './freehand/selection';
import { lineSelectionCapabilities } from './line/selection';
import { stickyNoteSelectionCapabilities } from './stickyNote/selection';
import { textSelectionCapabilities } from './text/selection';
import { connectorSelectionCapabilities } from './connector/selection';

/* ===== interactions ===== */
import { startFreehandDraft, updateFreehandDraft, finishFreehandDraft } from './freehand/interactions';
import { startLineDraft, updateLineDraft, finishLineDraft } from './line/interactions';
import { startRectangleDraft, updateRectangleDraft, finishRectangleDraft } from './rectangle/interactions';
import { startRoundedRectDraft, updateRoundedRectDraft, finishRoundedRectDraft } from './roundedRect/interactions';
import { startEllipseDraft, updateEllipseDraft, finishEllipseDraft } from './ellipse/interactions';
import { startDiamondDraft, updateDiamondDraft, finishDiamondDraft } from './diamond/interactions';
import { createTextObject } from './text/interactions';
import { createStickyNoteObject } from './stickyNote/interactions';
import { startConnectorDraft, updateConnectorDraft, finishConnectorDraft } from './connector/interactions';

const EMPTY_SELECTION_CAPS: SelectionCapabilities = { editableProps: [] };

export const SHAPES: Record<WhiteboardObjectType, ShapeToolDefinition> = {
  freehand: {
    type: 'freehand',
    draw: (ctx, obj, viewport) => drawFreehandObject(ctx, obj, viewport),
    getBoundingBox: (obj) => getFreehandBoundingBox(obj),
    translate: (obj, dx, dy) => translateFreehandObject(obj, dx, dy),
    resize: (obj, newBounds) => resizeFreehandObject(obj, newBounds),
    selectionCaps: freehandSelectionCapabilities,
    draft: {
      startDraft: (ctx: ToolPointerContext, pos: Point) =>
        startFreehandDraft({
          pos,
          strokeColor: ctx.strokeColor,
          strokeWidth: ctx.strokeWidth,
          generateObjectId: ctx.generateObjectId,
        }),
      updateDraft: (draft: DraftShape, _ctx: ToolPointerContext, pos: Point) =>
        updateFreehandDraft(draft, pos),
      finishDraft: (draft: DraftShape): ToolCreateResult | null => {
        const { object, selectIds } = finishFreehandDraft(draft);
        return object && selectIds ? { object, selectIds } : null;
      },
    },
  },

  line: {
    type: 'line',
    draw: (ctx, obj, viewport) => drawLineObject(ctx, obj, viewport),
    drawDraft: (ctx, draft, viewport) => drawLineDraft(ctx, draft, viewport),
    getBoundingBox: (obj) => getLineBoundingBox(obj),
    hitTest: (obj, worldX, worldY) => hitTestLine(obj, worldX, worldY),
    translate: (obj, dx, dy) => translateLineObject(obj, dx, dy),
    resize: (obj, newBounds) => resizeLineObject(obj, newBounds),
    selectionCaps: lineSelectionCapabilities,
    draft: {
      startDraft: (ctx: ToolPointerContext, pos: Point) =>
        startLineDraft({
          pos,
          strokeColor: ctx.strokeColor,
          strokeWidth: ctx.strokeWidth,
          arrowStart: (((ctx.toolProps as any)?.arrowStart ?? 'none') as any),
          arrowEnd: (((ctx.toolProps as any)?.arrowEnd ?? 'none') as any),
          generateObjectId: ctx.generateObjectId,
        }),
      updateDraft: (draft: DraftShape, _ctx: ToolPointerContext, pos: Point) => updateLineDraft(draft, pos),
      finishDraft: (draft: DraftShape): ToolCreateResult | null => {
        const { object, selectIds } = finishLineDraft(draft);
        return object && selectIds ? { object, selectIds } : null;
      },
    },
  },

  rectangle: {
    type: 'rectangle',
    draw: (ctx, obj, viewport) => drawRectangleObject(ctx, obj, viewport),
    getBoundingBox: (obj) => getRectangleBoundingBox(obj),
    resize: (obj, newBounds) => resizeBoxObjectByBounds(obj, newBounds),
    getPorts: (obj): ObjectPort[] => getRectanglePorts(obj),
    selectionCaps: rectangleSelectionCapabilities,
    draft: {
      startDraft: (ctx: ToolPointerContext, pos: Point) =>
        startRectangleDraft({
          pos,
          strokeColor: ctx.strokeColor,
          strokeWidth: ctx.strokeWidth,
          generateObjectId: ctx.generateObjectId,
        }),
      updateDraft: (draft: DraftShape, _ctx: ToolPointerContext, pos: Point) =>
        updateRectangleDraft(draft, pos),
      finishDraft: (draft: DraftShape, ctx: ToolPointerContext): ToolCreateResult | null => {
        const { object, selectIds } = finishRectangleDraft(draft);
        if (!object || !selectIds) return null;
        const fillColor = ctx.toolProps?.fillColor;
        return {
          object:
            typeof fillColor === 'string'
              ? ({ ...object, fillColor } as WhiteboardObject)
              : object,
          selectIds,
        };
      },
    },
  },
  roundedRect: {
    type: 'roundedRect',
    draw: (ctx, obj, viewport) => drawRoundedRectObject(ctx, obj, viewport),
    drawDraft: (ctx, draft, viewport) => drawRoundedRectDraft(ctx, draft, viewport),
    getBoundingBox: (obj) => getRoundedRectBoundingBox(obj),
    resize: (obj, newBounds) => resizeBoxObjectByBounds(obj, newBounds),
    getPorts: (obj): ObjectPort[] =>
      getRoundedRectPorts(obj).map((p) => ({ id: p.portId, point: p.point })),
    selectionCaps: roundedRectSelectionCapabilities,
    draft: {
      startDraft: (ctx: ToolPointerContext, pos: Point) =>
        startRoundedRectDraft({
          pos,
          strokeColor: ctx.strokeColor,
          strokeWidth: ctx.strokeWidth,
          generateObjectId: ctx.generateObjectId,
        }),
      updateDraft: (draft: DraftShape, _ctx: ToolPointerContext, pos: Point) =>
        updateRoundedRectDraft(draft, pos),
      finishDraft: (draft: DraftShape, ctx: ToolPointerContext): ToolCreateResult | null => {
        const { object, selectIds } = finishRoundedRectDraft(draft);
        if (!object || !selectIds) return null;

        const fillColor = ctx.toolProps?.fillColor;
        const cornerRadius = ctx.toolProps?.cornerRadius;
        let next: WhiteboardObject = object;
        if (typeof fillColor === 'string') next = { ...next, fillColor };
        if (typeof cornerRadius === 'number') next = { ...next, cornerRadius };

        return { object: next, selectIds };
      },
    },
  },

  ellipse: {
    type: 'ellipse',
    draw: (ctx, obj, viewport) => drawEllipseObject(ctx, obj, viewport),
    getBoundingBox: (obj) => getEllipseBoundingBox(obj),
    resize: (obj, newBounds) => resizeBoxObjectByBounds(obj, newBounds),
    getPorts: (obj): ObjectPort[] => getEllipsePorts(obj),
    selectionCaps: ellipseSelectionCapabilities,
    draft: {
      startDraft: (ctx: ToolPointerContext, pos: Point) =>
        startEllipseDraft({
          pos,
          strokeColor: ctx.strokeColor,
          strokeWidth: ctx.strokeWidth,
          generateObjectId: ctx.generateObjectId,
        }),
      updateDraft: (draft: DraftShape, _ctx: ToolPointerContext, pos: Point) =>
        updateEllipseDraft(draft, pos),
      finishDraft: (draft: DraftShape, ctx: ToolPointerContext): ToolCreateResult | null => {
        const { object, selectIds } = finishEllipseDraft(draft);
        if (!object || !selectIds) return null;
        const fillColor = ctx.toolProps?.fillColor;
        return {
          object:
            typeof fillColor === 'string'
              ? ({ ...object, fillColor } as WhiteboardObject)
              : object,
          selectIds,
        };
      },
    },
  },

  diamond: {
    type: 'diamond',
    connectorAttachmentPolicy: 'portsOnly',
    draw: (ctx, obj, viewport) => drawDiamondObject(ctx, obj, viewport),
    drawDraft: (ctx, draft, viewport, _env) => drawDiamondDraft(ctx, draft, viewport),
    getBoundingBox: (obj) => getDiamondBoundingBox(obj),
    resize: (obj, newBounds) => resizeBoxObjectByBounds(obj, newBounds),
    hitTest: (obj, worldX, worldY) => hitTestDiamond(obj, worldX, worldY),
    getPorts: (obj): ObjectPort[] => getDiamondPorts(obj),
    selectionCaps: diamondSelectionCapabilities,
    draft: {
      startDraft: (ctx: ToolPointerContext, pos: Point) =>
        startDiamondDraft({
          pos,
          strokeColor: ctx.strokeColor,
          strokeWidth: ctx.strokeWidth,
          generateObjectId: ctx.generateObjectId,
        }),
      updateDraft: (draft: DraftShape, _ctx: ToolPointerContext, pos: Point) =>
        updateDiamondDraft(draft, pos),
      finishDraft: (draft: DraftShape, ctx: ToolPointerContext): ToolCreateResult | null => {
        const { object, selectIds } = finishDiamondDraft(draft);
        if (!object || !selectIds) return null;
        const fillColor = ctx.toolProps?.fillColor;
        return {
          object:
            typeof fillColor === 'string'
              ? ({ ...object, fillColor } as WhiteboardObject)
              : object,
          selectIds,
        };
      },
    },
  },

  text: {
    type: 'text',
    draw: (ctx, obj, viewport, env) => {
      drawTextObject(ctx, obj, viewport, env.fallbackStrokeColor ?? '#000000');
    },
    getBoundingBox: (obj) => getTextBoundingBox(obj),
    resize: (obj, newBounds) => resizeBoxObjectByBounds(obj, newBounds),
    getPorts: (obj): ObjectPort[] => getTextPorts(obj),
    selectionCaps: textSelectionCapabilities,
    pointerDownCreate: (ctx: ToolPointerContext, pos: Point) => {
      const { object, selectIds } = createTextObject({
        pos,
        strokeColor: ctx.strokeColor,
        strokeWidth: ctx.strokeWidth,
        textColor: (ctx.toolProps?.textColor as any) ?? undefined,
        fontSize: (ctx.toolProps?.fontSize as any) ?? undefined,
        text: (ctx.toolProps?.text as any) ?? undefined,
        generateObjectId: ctx.generateObjectId,
      });
      return object && selectIds ? { object, selectIds } : null;
    },
  },

  stickyNote: {
    type: 'stickyNote',
    draw: (ctx, obj, viewport, env) =>
      drawStickyNoteObject(ctx, obj, viewport, env.fallbackStrokeColor ?? '#000000'),
    getBoundingBox: (obj) => getStickyNoteBoundingBox(obj),
    resize: (obj, newBounds) => resizeBoxObjectByBounds(obj, newBounds),
    getPorts: (obj): ObjectPort[] => getStickyNotePorts(obj),
    selectionCaps: stickyNoteSelectionCapabilities,
    pointerDownCreate: (ctx: ToolPointerContext, pos: Point) => {
      const { object, selectIds } = createStickyNoteObject({
        pos,
        strokeColor: ctx.strokeColor,
        strokeWidth: ctx.strokeWidth,
        fillColor: (ctx.toolProps?.fillColor as any) ?? undefined,
        textColor: (ctx.toolProps?.textColor as any) ?? undefined,
        fontSize: (ctx.toolProps?.fontSize as any) ?? undefined,
        text: (ctx.toolProps?.text as any) ?? undefined,
        generateObjectId: ctx.generateObjectId,
      });
      return object && selectIds ? { object, selectIds } : null;
    },
  },

  connector: {
    type: 'connector',
    translate: () => null,
    draw: (ctx, obj, viewport, env) => {
      const objects = env.objects ?? [];
      drawConnectorObject(ctx, obj, objects, viewport);
    },
    getBoundingBox: (obj, env) => {
      const objects = env?.objects ?? [];
      return getConnectorBoundingBox(obj, objects);
    },
    hitTest: (obj, worldX, worldY, env) => {
      const objects = env?.objects ?? [];
      return hitTestConnector(objects, obj, worldX, worldY);
    },
    selectionCaps: connectorSelectionCapabilities,
    draft: {
      startDraft: (ctx: ToolPointerContext, pos: Point) =>
        startConnectorDraft({
          pos,
          objects: ctx.objects,
          viewport: ctx.viewport,
          strokeColor: ctx.strokeColor,
          strokeWidth: ctx.strokeWidth,
          generateObjectId: ctx.generateObjectId,
        }),
      updateDraft: (draft: DraftShape, ctx: ToolPointerContext, pos: Point) =>
        updateConnectorDraft({
          draft,
          pos,
          objects: ctx.objects,
          viewport: ctx.viewport,
        }),
      finishDraft: (draft: DraftShape, ctx: ToolPointerContext, pos: Point): ToolCreateResult | null => {
        const { object, selectIds } = finishConnectorDraft({
          draft,
          pos,
          objects: ctx.objects,
          viewport: ctx.viewport,
        });
        return object && selectIds ? { object, selectIds } : null;
      },
    },
  },
};

export function getShape(type: WhiteboardObjectType): ShapeToolDefinition {
  return SHAPES[type];
}

export function getPortsFor(obj: WhiteboardObject): ObjectPort[] {
  const def = SHAPES[obj.type];
  return def.getPorts ? def.getPorts(obj) : [];
}

export function getSelectionCaps(type: WhiteboardObjectType): SelectionCapabilities {
  const def = SHAPES[type];
  return def.selectionCaps ?? EMPTY_SELECTION_CAPS;
}

/* ======================================================================== */
/* Step C3: Interactions dispatch lives here (no separate interactionsRegistry) */
/* ======================================================================== */

export type ToolPointerDownResult =
  | { kind: 'noop' }
  | { kind: 'draft'; draft: DraftShape; capturePointer: true }
  | { kind: 'create'; object: WhiteboardObject; selectIds: ObjectId[] };

export type ToolPointerMoveResult = { kind: 'draft'; draft: DraftShape };

export type ToolPointerUpResult =
  | { kind: 'noop' }
  | { kind: 'create'; object: WhiteboardObject; selectIds: ObjectId[] };

export function toolPointerDown(
  tool: DrawingTool,
  ctx: ToolPointerContext,
  pos: Point
): ToolPointerDownResult {
  // select tool is handled by core pointer plumbing
  if (tool === 'select') return { kind: 'noop' };

  // For shape tools, tool id matches object type.
  const def = SHAPES[tool as unknown as WhiteboardObjectType];
  if (!def) return { kind: 'noop' };

  // 1) Click-to-create tools (text, stickyNote, ...)
  if (def.pointerDownCreate) {
    const res = def.pointerDownCreate(ctx, pos);
    return res
      ? { kind: 'create', object: res.object, selectIds: res.selectIds }
      : { kind: 'noop' };
  }

  // 2) Draft-based tools (freehand, rectangle, ellipse, connector, ...)
  const start = def.draft?.startDraft;
  if (!start) return { kind: 'noop' };

  const draft0 = start(ctx, pos);
  if (!draft0) return { kind: 'noop' };

  // Step D1: tag the draft with its owning tool/object type so tools can reuse
  // an existing draft kind but still dispatch update/finish to the owning tool.
  const draft = ({ ...draft0, toolType: def.type } as unknown) as DraftShape;

  return { kind: 'draft', draft, capturePointer: true };
}

function getDefForDraft(draft: DraftShape): ShapeToolDefinition | undefined {
  // Step D1: Prefer toolType if present; fall back to the draft kind.
  const key = ((draft as any).toolType ?? draft.kind) as WhiteboardObjectType;
  return SHAPES[key];
}

export function toolPointerMove(
  draft: DraftShape,
  ctx: ToolPointerContext,
  pos: Point
): ToolPointerMoveResult {
  const def = getDefForDraft(draft);
  const update = def?.draft?.updateDraft;
  if (!update) return { kind: 'draft', draft };
  return { kind: 'draft', draft: update(draft, ctx, pos) };
}

export function toolPointerUp(
  draft: DraftShape,
  ctx: ToolPointerContext,
  pos: Point
): ToolPointerUpResult {
  const def = getDefForDraft(draft);
  const finish = def?.draft?.finishDraft;
  if (!finish) return { kind: 'noop' };

  const res = finish(draft, ctx, pos);
  return res
    ? { kind: 'create', object: res.object, selectIds: res.selectIds }
    : { kind: 'noop' };
}

/**
 * Translate an object by dx/dy using per-shape behavior.
 * - Shapes may override translate() (e.g., freehand shifts points; connector returns null).
 * - Default behavior: translate x/y only.
 */
export function translateObject(
  obj: WhiteboardObject,
  dx: number,
  dy: number
): Partial<WhiteboardObject> | null {
  const def = SHAPES[obj.type as WhiteboardObjectType];
  if (def?.translate) {
    return def.translate(obj as any, dx, dy) as any;
  }
  if (typeof obj.x !== 'number' || typeof obj.y !== 'number') return null;
  return { x: obj.x + dx, y: obj.y + dy };
}

/**
 * Registry-driven resize plumbing.
 *
 * A shape is considered resizable if it provides a resize() implementation.
 * (Core computes newBounds; shapes decide how to apply it.)
 */
export function canResizeObject(obj: WhiteboardObject): boolean {
  const def = SHAPES[obj.type as WhiteboardObjectType];
  return typeof def?.resize === 'function';
}

/**
 * Resize an object by delegating to the owning shape definition.
 * Returns a patch to apply via onUpdateObject(), or null if not resizable.
 */
export function resizeObject(
  obj: WhiteboardObject,
  newBounds: Bounds
): Partial<WhiteboardObject> | null {
  const def = SHAPES[obj.type as WhiteboardObjectType];
  if (!def?.resize) return null;
  return (def.resize as any)(obj as any, newBounds) as any;
}