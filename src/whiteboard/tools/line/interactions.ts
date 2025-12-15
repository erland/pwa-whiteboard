// src/whiteboard/tools/line/interactions.ts

import type { WhiteboardObject, ObjectId, Point, ArrowType } from '../../../domain/types';
import type { DraftShape } from '../../drawing';

export type LineStartArgs = {
  pos: Point;
  strokeColor: string;
  strokeWidth: number;
  arrowStart: ArrowType;
  arrowEnd: ArrowType;
  generateObjectId: () => ObjectId;
};

export function startLineDraft(args: LineStartArgs): DraftShape {
  const { pos, strokeColor, strokeWidth, arrowStart, arrowEnd, generateObjectId } = args;

  // Reuse the rectangle draft kind (startX/startY/currentX/currentY), but mark toolType as 'line'
  // so the shape registry can route updates/finish to this tool.
  const draft: any = {
    kind: 'rectangle',
    toolType: 'line',
    id: generateObjectId(),
    strokeColor,
    strokeWidth,
    startX: pos.x,
    startY: pos.y,
    currentX: pos.x,
    currentY: pos.y,
    arrowStart,
    arrowEnd,
  };

  return draft as DraftShape;
}

export function updateLineDraft(draft: DraftShape, pos: Point): DraftShape {
  if ((draft as any).toolType !== 'line') return draft;
  if (draft.kind !== 'rectangle') return draft;
  return { ...(draft as any), currentX: pos.x, currentY: pos.y } as DraftShape;
}

export function finishLineDraft(draft: DraftShape): { object?: WhiteboardObject; selectIds?: ObjectId[] } {
  if ((draft as any).toolType !== 'line') return {};
  if (draft.kind !== 'rectangle') return {};

  const d: any = draft as any;
  const { startX, startY, currentX, currentY } = d as {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  };

  if (startX === currentX && startY === currentY) return {};

  const obj: WhiteboardObject = {
    id: d.id as ObjectId,
    type: 'line',
    x: startX,
    y: startY,
    x2: currentX,
    y2: currentY,
    strokeColor: d.strokeColor,
    strokeWidth: d.strokeWidth,
    // Important: store explicit values (not undefined) so selection UI can show 'None' explicitly.
    arrowStart: (d as any).arrowStart ?? 'none',
    arrowEnd: (d as any).arrowEnd ?? 'none',
  };

  return { object: obj, selectIds: [obj.id] };
}
