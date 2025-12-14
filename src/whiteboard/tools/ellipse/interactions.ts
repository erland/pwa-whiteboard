import type { WhiteboardObject, ObjectId, Point } from '../../../domain/types';
import type { DraftShape } from '../../drawing';
import {
  type BoxStartArgs,
  startBoxDraft,
  updateBoxDraft,
  finishBoxDraft,
} from '../_shared/boxDraft';

export type { BoxStartArgs };

export function startEllipseDraft(args: BoxStartArgs): DraftShape {
  return startBoxDraft(args, 'ellipse');
}

export function updateEllipseDraft(draft: DraftShape, pos: Point): DraftShape {
  return updateBoxDraft(draft, 'ellipse', pos);
}

export function finishEllipseDraft(draft: DraftShape): {
  object?: WhiteboardObject;
  selectIds?: ObjectId[];
} {
  return finishBoxDraft(draft, 'ellipse', 'ellipse');
}
