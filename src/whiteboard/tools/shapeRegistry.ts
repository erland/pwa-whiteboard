import type { WhiteboardObject, WhiteboardObjectType, Point, ObjectId } from '../../domain/types';
import type { ShapeToolDefinition, ToolPointerContext, ObjectPort } from './shapeTypes';
import type { SelectionCapabilities } from './selection/types';
import type { DraftShape } from '../drawing';
import type { DrawingTool } from '../whiteboardTypes';
import type { Bounds } from '../geometry/types';

import {
  EMPTY_SELECTION_CAPS,
  createShapeDefinitions,
  toolPointerDown as dispatchToolPointerDown,
  toolPointerMove as dispatchToolPointerMove,
  toolPointerUp as dispatchToolPointerUp,
} from './shapeRegistry/index';

export const SHAPES: Record<WhiteboardObjectType, ShapeToolDefinition> = createShapeDefinitions();

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
  return dispatchToolPointerDown(SHAPES, tool, ctx, pos);
}

export function toolPointerMove(
  draft: DraftShape,
  ctx: ToolPointerContext,
  pos: Point
): ToolPointerMoveResult {
  return dispatchToolPointerMove(SHAPES, draft, ctx, pos);
}

export function toolPointerUp(
  draft: DraftShape,
  ctx: ToolPointerContext,
  pos: Point
): ToolPointerUpResult {
  return dispatchToolPointerUp(SHAPES, draft, ctx, pos);
}

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

export function canResizeObject(obj: WhiteboardObject): boolean {
  const def = SHAPES[obj.type as WhiteboardObjectType];
  return typeof def?.resize === 'function';
}

export function resizeObject(
  obj: WhiteboardObject,
  newBounds: Bounds
): Partial<WhiteboardObject> | null {
  const def = SHAPES[obj.type as WhiteboardObjectType];
  if (!def?.resize) return null;
  return (def.resize as any)(obj as any, newBounds) as any;
}
