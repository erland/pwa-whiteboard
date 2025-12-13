// src/whiteboard/tools/diamond/interactions.ts
import type { WhiteboardObject, ObjectId, Point } from '../../../domain/types';
import type { DraftShape } from '../../drawing';

import type { BoxStartArgs } from '../rectangle/interactions';
import {
  startRectangleDraft,
  updateRectangleDraft,
} from '../rectangle/interactions';

/**
 * Diamond reuses the existing rectangle draft shape (kind: 'rectangle') to keep DraftShape stable (Step D1).
 * The owning tool is tracked via draft.toolType by the core dispatcher.
 */
export function startDiamondDraft(args: BoxStartArgs): DraftShape {
  return startRectangleDraft(args);
}

export function updateDiamondDraft(draft: DraftShape, pos: Point): DraftShape {
  return updateRectangleDraft(draft, pos);
}

export function finishDiamondDraft(draft: DraftShape): {
  object?: WhiteboardObject;
  selectIds?: ObjectId[];
} {
  if (draft.kind !== 'rectangle') return {};

  const { startX, startY, currentX, currentY } = draft as any;
  if (startX === currentX && startY === currentY) return {};

  const x1 = Math.min(startX, currentX);
  const y1 = Math.min(startY, currentY);
  const x2 = Math.max(startX, currentX);
  const y2 = Math.max(startY, currentY);

  const obj: WhiteboardObject = {
    id: (draft as any).id,
    type: 'diamond',
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
    strokeColor: (draft as any).strokeColor,
    strokeWidth: (draft as any).strokeWidth,
  };

  return { object: obj, selectIds: [obj.id] };
}
