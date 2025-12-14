// src/whiteboard/tools/diamond/interactions.ts
import type { WhiteboardObject, ObjectId, Point } from '../../../domain/types';
import type { DraftShape } from '../../drawing';

import {
  type BoxStartArgs,
  startBoxDraft,
  updateBoxDraft,
  finishBoxDraft,
} from '../_shared/boxDraft';

/**
 * Diamond reuses the existing rectangle draft shape (kind: 'rectangle') to keep DraftShape stable (Step D1).
 * The owning tool is tracked via draft.toolType by the core dispatcher.
 */
export function startDiamondDraft(args: BoxStartArgs): DraftShape {
  return startBoxDraft(args, 'rectangle');
}

export function updateDiamondDraft(draft: DraftShape, pos: Point): DraftShape {
  return updateBoxDraft(draft, 'rectangle', pos);
}

export function finishDiamondDraft(draft: DraftShape): {
  object?: WhiteboardObject;
  selectIds?: ObjectId[];
} {
  return finishBoxDraft(draft, 'rectangle', 'diamond');
}
