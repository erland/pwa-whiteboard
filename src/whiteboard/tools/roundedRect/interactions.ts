// src/whiteboard/tools/roundedRect/interactions.ts
import type { WhiteboardObject, ObjectId, Point } from '../../../domain/types';
import type { DraftShape } from '../../drawing';
import { startBoxDraft, updateBoxDraft, finishBoxDraft } from '../_shared/boxDraft';

type StartRoundedRectDraftArgs = {
  pos: Point;
  strokeColor: string;
  strokeWidth: number;
  generateObjectId: () => ObjectId;
};

const DEFAULT_CORNER_RADIUS = 12;

export function startRoundedRectDraft(args: StartRoundedRectDraftArgs): DraftShape {
  // We reuse the stable 'rectangle' draft kind (box drag) but set toolType so draft rendering & finish dispatch correctly.
  const draft = startBoxDraft(args, 'rectangle');
  return { ...draft, toolType: 'roundedRect' };
}

export function updateRoundedRectDraft(draft: DraftShape, pos: Point): DraftShape {
  return updateBoxDraft(draft, 'rectangle', pos);
}

export function finishRoundedRectDraft(draft: DraftShape): {
  object?: WhiteboardObject;
  selectIds?: ObjectId[];
} {
  const res = finishBoxDraft(draft, 'rectangle', 'roundedRect');
  if (!res.object) return res;

  return {
    ...res,
    object: {
      ...res.object,
      cornerRadius: DEFAULT_CORNER_RADIUS,
    },
  };
}
