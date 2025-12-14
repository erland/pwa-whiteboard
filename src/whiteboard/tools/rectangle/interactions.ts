import type { WhiteboardObject, ObjectId, Point } from '../../../domain/types';
import type { DraftShape } from '../../drawing';
import {
  type BoxStartArgs,
  startBoxDraft,
  updateBoxDraft,
  finishBoxDraft,
} from '../_shared/boxDraft';

export type { BoxStartArgs };

export function startRectangleDraft(args: BoxStartArgs): DraftShape {
  return startBoxDraft(args, 'rectangle');
}

export function updateRectangleDraft(draft: DraftShape, pos: Point): DraftShape {
  return updateBoxDraft(draft, 'rectangle', pos);
}

export function finishRectangleDraft(draft: DraftShape): {
  object?: WhiteboardObject;
  selectIds?: ObjectId[];
} {
  return finishBoxDraft(draft, 'rectangle', 'rectangle');
}
