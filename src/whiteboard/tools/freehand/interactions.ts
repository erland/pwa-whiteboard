import type { WhiteboardObject, ObjectId, Point } from '../../../domain/types';
import type { DraftShape } from '../../drawing';

export type FreehandStartArgs = {
  pos: Point;
  strokeColor: string;
  strokeWidth: number;
  generateObjectId: () => ObjectId;
};

export function startFreehandDraft({
  pos,
  strokeColor,
  strokeWidth,
  generateObjectId,
}: FreehandStartArgs): DraftShape {
  return {
    kind: 'freehand',
    id: generateObjectId(),
    strokeColor,
    strokeWidth,
    points: [pos],
  };
}

export function updateFreehandDraft(draft: DraftShape, pos: Point): DraftShape {
  if (draft.kind !== 'freehand') return draft;
  return { ...draft, points: [...draft.points, pos] };
}

export function finishFreehandDraft(draft: DraftShape): {
  object?: WhiteboardObject;
  selectIds?: ObjectId[];
} {
  if (draft.kind !== 'freehand') return {};
  if (draft.points.length < 2) return {};

  const xs = draft.points.map((p) => p.x);
  const ys = draft.points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  const obj: WhiteboardObject = {
    id: draft.id,
    type: 'freehand',
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    strokeColor: draft.strokeColor,
    strokeWidth: draft.strokeWidth,
    points: draft.points,
  };

  return { object: obj, selectIds: [draft.id] };
}
