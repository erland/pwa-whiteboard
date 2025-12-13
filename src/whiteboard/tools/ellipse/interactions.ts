import type { WhiteboardObject, ObjectId, Point } from '../../../domain/types';
import type { DraftShape } from '../../drawing';

export type BoxStartArgs = {
  pos: Point;
  strokeColor: string;
  strokeWidth: number;
  generateObjectId: () => ObjectId;
};

export function startEllipseDraft({
  pos,
  strokeColor,
  strokeWidth,
  generateObjectId,
}: BoxStartArgs): DraftShape {
  return {
    kind: 'ellipse',
    id: generateObjectId(),
    strokeColor,
    strokeWidth,
    startX: pos.x,
    startY: pos.y,
    currentX: pos.x,
    currentY: pos.y,
  };
}

export function updateEllipseDraft(draft: DraftShape, pos: Point): DraftShape {
  if (draft.kind !== 'ellipse') return draft;
  return { ...draft, currentX: pos.x, currentY: pos.y };
}

export function finishEllipseDraft(draft: DraftShape): {
  object?: WhiteboardObject;
  selectIds?: ObjectId[];
} {
  if (draft.kind !== 'ellipse') return {};
  const { startX, startY, currentX, currentY } = draft;
  if (startX === currentX && startY === currentY) return {};

  const x1 = Math.min(startX, currentX);
  const y1 = Math.min(startY, currentY);
  const x2 = Math.max(startX, currentX);
  const y2 = Math.max(startY, currentY);

  const obj: WhiteboardObject = {
    id: draft.id,
    type: 'ellipse',
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
    strokeColor: draft.strokeColor,
    strokeWidth: draft.strokeWidth,
  };

  return { object: obj, selectIds: [draft.id] };
}
