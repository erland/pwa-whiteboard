import type { DrawingTool } from '../whiteboardTypes';
import type { DraftShape } from '../drawing';
import type { ObjectId, Point, Viewport, WhiteboardObject } from '../../domain/types';

import { startFreehandDraft, updateFreehandDraft, finishFreehandDraft } from './freehand/interactions';
import { startRectangleDraft, updateRectangleDraft, finishRectangleDraft } from './rectangle/interactions';
import { startEllipseDraft, updateEllipseDraft, finishEllipseDraft } from './ellipse/interactions';
import { createTextObject } from './text/interactions';
import { createStickyNoteObject } from './stickyNote/interactions';
import {
  startConnectorDraft,
  updateConnectorDraft,
  finishConnectorDraft,
} from './connector/interactions';

export type ToolPointerContext = {
  objects: WhiteboardObject[];
  viewport: Viewport;
  strokeColor: string;
  strokeWidth: number;
  generateObjectId: () => ObjectId;
};

export type ToolPointerDownResult =
  | { kind: 'noop' }
  | { kind: 'draft'; draft: DraftShape; capturePointer: true }
  | { kind: 'create'; object: WhiteboardObject; selectIds: ObjectId[] };

export type ToolPointerMoveResult = { kind: 'draft'; draft: DraftShape };

export type ToolPointerUpResult =
  | { kind: 'noop' }
  | { kind: 'create'; object: WhiteboardObject; selectIds: ObjectId[] };

type ToolPointerDownHandler = (ctx: ToolPointerContext, pos: Point) => ToolPointerDownResult;

type DraftKind = DraftShape['kind'];

type DraftPointerMoveHandler = (draft: DraftShape, ctx: ToolPointerContext, pos: Point) => DraftShape;

type DraftPointerUpHandler = (draft: DraftShape, ctx: ToolPointerContext, pos: Point) => ToolPointerUpResult;

/**
 * Registry map refinement:
 * - No switches needed for tool pointer-down behavior.
 * - Adding a new tool becomes "implement tool module + add one line here".
 */
const TOOL_POINTER_DOWN_HANDLERS: Partial<Record<DrawingTool, ToolPointerDownHandler>> = {
  freehand: (ctx, pos) => ({
    kind: 'draft',
    draft: startFreehandDraft({ pos, ...ctx }),
    capturePointer: true,
  }),

  rectangle: (ctx, pos) => ({
    kind: 'draft',
    draft: startRectangleDraft({ pos, ...ctx }),
    capturePointer: true,
  }),

  ellipse: (ctx, pos) => ({
    kind: 'draft',
    draft: startEllipseDraft({ pos, ...ctx }),
    capturePointer: true,
  }),

  connector: (ctx, pos) => {
    const draft = startConnectorDraft({ pos, ...ctx });
    return draft ? { kind: 'draft', draft, capturePointer: true } : { kind: 'noop' };
  },

  text: (ctx, pos) => {
    const { object, selectIds } = createTextObject({ pos, ...ctx });
    return object && selectIds ? { kind: 'create', object, selectIds } : { kind: 'noop' };
  },

  stickyNote: (ctx, pos) => {
    const { object, selectIds } = createStickyNoteObject({ pos, ...ctx });
    return object && selectIds ? { kind: 'create', object, selectIds } : { kind: 'noop' };
  },

  // select intentionally has no handler here (core handles selection/pan/move/resize).
};

/**
 * Registry map refinement:
 * - No switches needed for draft pointer-move behavior.
 */
const DRAFT_POINTER_MOVE_HANDLERS: Record<DraftKind, DraftPointerMoveHandler> = {
  freehand: (draft, _ctx, pos) => updateFreehandDraft(draft as any, pos),
  rectangle: (draft, _ctx, pos) => updateRectangleDraft(draft as any, pos),
  ellipse: (draft, _ctx, pos) => updateEllipseDraft(draft as any, pos),
  connector: (draft, ctx, pos) =>
    updateConnectorDraft({ draft: draft as any, pos, objects: ctx.objects, viewport: ctx.viewport }),
};

/**
 * Registry map refinement:
 * - No switches needed for draft pointer-up behavior.
 */
const DRAFT_POINTER_UP_HANDLERS: Record<DraftKind, DraftPointerUpHandler> = {
  freehand: (draft) => {
    const { object, selectIds } = finishFreehandDraft(draft as any);
    return object && selectIds ? { kind: 'create', object, selectIds } : { kind: 'noop' };
  },

  rectangle: (draft) => {
    const { object, selectIds } = finishRectangleDraft(draft as any);
    return object && selectIds ? { kind: 'create', object, selectIds } : { kind: 'noop' };
  },

  ellipse: (draft) => {
    const { object, selectIds } = finishEllipseDraft(draft as any);
    return object && selectIds ? { kind: 'create', object, selectIds } : { kind: 'noop' };
  },

  connector: (draft, ctx, pos) => {
    const { object, selectIds } = finishConnectorDraft({
      draft: draft as any,
      pos,
      objects: ctx.objects,
      viewport: ctx.viewport,
    });
    return object && selectIds ? { kind: 'create', object, selectIds } : { kind: 'noop' };
  },
};

export function toolPointerDown(
  tool: DrawingTool,
  ctx: ToolPointerContext,
  pos: Point
): ToolPointerDownResult {
  const handler = TOOL_POINTER_DOWN_HANDLERS[tool];
  return handler ? handler(ctx, pos) : { kind: 'noop' };
}

export function toolDraftPointerMove(
  draft: DraftShape,
  ctx: ToolPointerContext,
  pos: Point
): ToolPointerMoveResult {
  const handler = DRAFT_POINTER_MOVE_HANDLERS[draft.kind];
  return { kind: 'draft', draft: handler(draft, ctx, pos) };
}

export function toolDraftPointerUp(
  draft: DraftShape,
  ctx: ToolPointerContext,
  pos: Point
): ToolPointerUpResult {
  const handler = DRAFT_POINTER_UP_HANDLERS[draft.kind];
  return handler(draft, ctx, pos);
}
