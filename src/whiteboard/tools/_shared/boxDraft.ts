// src/whiteboard/tools/_shared/boxDraft.ts
//
// Shared "box drag" draft lifecycle for rectangle-like tools (rectangle/ellipse/diamond).
// - Draft kinds remain stable: 'rectangle' | 'ellipse'.
// - The created object type can be different (e.g. diamond uses draftKind='rectangle' but objectType='diamond').

import type { WhiteboardObject, ObjectId, Point, WhiteboardObjectType } from '../../../domain/types';
import type { DraftShape } from '../../drawing';

export type BoxDraftKind = Extract<DraftShape, { kind: 'rectangle' | 'ellipse' }>['kind'];

export type BoxStartArgs = {
  pos: Point;
  strokeColor: string;
  strokeWidth: number;
  generateObjectId: () => ObjectId;
};

export function startBoxDraft(args: BoxStartArgs, draftKind: BoxDraftKind): DraftShape {
  const { pos, strokeColor, strokeWidth, generateObjectId } = args;

  return {
    kind: draftKind,
    id: generateObjectId(),
    strokeColor,
    strokeWidth,
    startX: pos.x,
    startY: pos.y,
    currentX: pos.x,
    currentY: pos.y,
  };
}

export function updateBoxDraft(draft: DraftShape, draftKind: BoxDraftKind, pos: Point): DraftShape {
  if (draft.kind !== draftKind) return draft;
  return { ...draft, currentX: pos.x, currentY: pos.y };
}

export function finishBoxDraft(
  draft: DraftShape,
  draftKind: BoxDraftKind,
  objectType: WhiteboardObjectType
): { object?: WhiteboardObject; selectIds?: ObjectId[] } {
  if (draft.kind !== draftKind) return {};

  const box = draft as Extract<DraftShape, { kind: 'rectangle' | 'ellipse' }>;
  const { startX, startY, currentX, currentY } = box;
  if (startX === currentX && startY === currentY) return {};

  const x1 = Math.min(startX, currentX);
  const y1 = Math.min(startY, currentY);
  const x2 = Math.max(startX, currentX);
  const y2 = Math.max(startY, currentY);

  const obj: WhiteboardObject = {
    id: box.id,
    type: objectType,
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
    strokeColor: box.strokeColor,
    strokeWidth: box.strokeWidth,
  };

  return { object: obj, selectIds: [obj.id] };
}
