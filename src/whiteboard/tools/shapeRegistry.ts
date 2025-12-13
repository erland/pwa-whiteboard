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
import type { ObjectPort } from './shapeTypes';
import type { SelectionCapabilities } from './selection/types';
import type { DraftShape } from '../drawing';
import type { DrawingTool } from '../whiteboardTypes';

/* ===== draw ===== */
import { drawFreehandObject } from './freehand/draw';
import { drawRectangleObject } from './rectangle/draw';
import { drawEllipseObject } from './ellipse/draw';
import { drawDiamondObject } from './diamond/draw';
import { drawTextObject } from './text/draw';
import { drawStickyNoteObject } from './stickyNote/draw';
import { drawConnectorObject } from './connector/draw';

/* ===== geometry / ports ===== */
import { getFreehandBoundingBox } from './freehand/geometry';
import { getRectangleBoundingBox, getRectanglePorts } from './rectangle/geometry';
import { getEllipseBoundingBox, getEllipsePorts } from './ellipse/geometry';
import { getDiamondBoundingBox, getDiamondPorts, hitTestDiamond } from './diamond/geometry';
import { getTextBoundingBox, getTextPorts } from './text/geometry';
import { getStickyNoteBoundingBox, getStickyNotePorts } from './stickyNote/geometry';
import { getConnectorBoundingBox, hitTestConnector } from './connector/geometry';

/* ===== selection capabilities ===== */
import { rectangleSelectionCapabilities } from './rectangle/selection';
import { ellipseSelectionCapabilities } from './ellipse/selection';
import { diamondSelectionCapabilities } from './diamond/selection';
import { stickyNoteSelectionCapabilities } from './stickyNote/selection';
import { textSelectionCapabilities } from './text/selection';
import { connectorSelectionCapabilities } from './connector/selection';

/* ===== interactions ===== */
import { startFreehandDraft, updateFreehandDraft, finishFreehandDraft } from './freehand/interactions';
import { startRectangleDraft, updateRectangleDraft, finishRectangleDraft } from './rectangle/interactions';
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

  rectangle: {
    type: 'rectangle',
    draw: (ctx, obj, viewport) => drawRectangleObject(ctx, obj, viewport),
    getBoundingBox: (obj) => getRectangleBoundingBox(obj),
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
      finishDraft: (draft: DraftShape): ToolCreateResult | null => {
        const { object, selectIds } = finishRectangleDraft(draft);
        return object && selectIds ? { object, selectIds } : null;
      },
    },
  },

  ellipse: {
    type: 'ellipse',
    draw: (ctx, obj, viewport) => drawEllipseObject(ctx, obj, viewport),
    getBoundingBox: (obj) => getEllipseBoundingBox(obj),
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
      finishDraft: (draft: DraftShape): ToolCreateResult | null => {
        const { object, selectIds } = finishEllipseDraft(draft);
        return object && selectIds ? { object, selectIds } : null;
      },
    },
  },

  diamond: {
    type: 'diamond',
    connectorAttachmentPolicy: 'portsOnly',
    draw: (ctx, obj, viewport) => drawDiamondObject(ctx, obj, viewport),
    getBoundingBox: (obj) => getDiamondBoundingBox(obj),
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
      finishDraft: (draft: DraftShape): ToolCreateResult | null => {
        const { object, selectIds } = finishDiamondDraft(draft);
        return object && selectIds ? { object, selectIds } : null;
      },
    },
  },

  text: {
    type: 'text',
    draw: (ctx, obj, viewport, env) => {
      drawTextObject(ctx, obj, viewport, env.fallbackStrokeColor ?? '#000000');
    },
    getBoundingBox: (obj) => getTextBoundingBox(obj),
    getPorts: (obj): ObjectPort[] => getTextPorts(obj),
    selectionCaps: textSelectionCapabilities,
    pointerDownCreate: (ctx: ToolPointerContext, pos: Point) => {
      const { object, selectIds } = createTextObject({
        pos,
        strokeColor: ctx.strokeColor,
        strokeWidth: ctx.strokeWidth,
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
    getPorts: (obj): ObjectPort[] => getStickyNotePorts(obj),
    selectionCaps: stickyNoteSelectionCapabilities,
    pointerDownCreate: (ctx: ToolPointerContext, pos: Point) => {
      const { object, selectIds } = createStickyNoteObject({
        pos,
        strokeColor: ctx.strokeColor,
        strokeWidth: ctx.strokeWidth,
        generateObjectId: ctx.generateObjectId,
      });
      return object && selectIds ? { object, selectIds } : null;
    },
  },

  connector: {
    type: 'connector',
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
