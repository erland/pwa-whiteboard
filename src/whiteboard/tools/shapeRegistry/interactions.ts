import type { WhiteboardObject, WhiteboardObjectType, Point, ObjectId } from '../../../domain/types';
import type { ToolPointerContext, ShapeToolDefinition } from '../shapeTypes';
import type { DraftShape } from '../../drawing';
import type { DrawingTool } from '../../whiteboardTypes';

export type ToolPointerDownResult =
  | { kind: 'noop' }
  | { kind: 'draft'; draft: DraftShape; capturePointer: true }
  | { kind: 'create'; object: WhiteboardObject; selectIds: ObjectId[] };

export type ToolPointerMoveResult = { kind: 'draft'; draft: DraftShape };

export type ToolPointerUpResult =
  | { kind: 'noop' }
  | { kind: 'create'; object: WhiteboardObject; selectIds: ObjectId[] };

export function toolPointerDown(
  shapes: Record<WhiteboardObjectType, ShapeToolDefinition>,
  tool: DrawingTool,
  ctx: ToolPointerContext,
  pos: Point
): ToolPointerDownResult {
  if (tool === 'select') return { kind: 'noop' };

  const def = shapes[tool as unknown as WhiteboardObjectType];
  if (!def) return { kind: 'noop' };

  if (def.pointerDownCreate) {
    const res = def.pointerDownCreate(ctx, pos);
    return res ? { kind: 'create', object: res.object, selectIds: res.selectIds } : { kind: 'noop' };
  }

  const start = def.draft?.startDraft;
  if (!start) return { kind: 'noop' };

  const draft0 = start(ctx, pos);
  if (!draft0) return { kind: 'noop' };

  const draft = ({ ...draft0, toolType: def.type } as unknown) as DraftShape;
  return { kind: 'draft', draft, capturePointer: true };
}

function getDefForDraft(
  shapes: Record<WhiteboardObjectType, ShapeToolDefinition>,
  draft: DraftShape
): ShapeToolDefinition | undefined {
  const key = ((draft as any).toolType ?? draft.kind) as WhiteboardObjectType;
  return shapes[key];
}

export function toolPointerMove(
  shapes: Record<WhiteboardObjectType, ShapeToolDefinition>,
  draft: DraftShape,
  ctx: ToolPointerContext,
  pos: Point
): ToolPointerMoveResult {
  const def = getDefForDraft(shapes, draft);
  const update = def?.draft?.updateDraft;
  if (!update) return { kind: 'draft', draft };
  return { kind: 'draft', draft: update(draft, ctx, pos) };
}

export function toolPointerUp(
  shapes: Record<WhiteboardObjectType, ShapeToolDefinition>,
  draft: DraftShape,
  ctx: ToolPointerContext,
  pos: Point
): ToolPointerUpResult {
  const def = getDefForDraft(shapes, draft);
  const finish = def?.draft?.finishDraft;
  if (!finish) return { kind: 'noop' };

  const res = finish(draft, ctx, pos);
  return res ? { kind: 'create', object: res.object, selectIds: res.selectIds } : { kind: 'noop' };
}
