import type { WhiteboardObject, ObjectId, Point } from '../../../domain/types';

export type StickyNoteStartArgs = {
  pos: Point;
  strokeColor: string;
  strokeWidth: number;
  generateObjectId: () => ObjectId;
};

export function createStickyNoteObject({
  pos,
  strokeColor,
  strokeWidth,
  generateObjectId,
}: StickyNoteStartArgs): {
  object: WhiteboardObject;
  selectIds: ObjectId[];
} {
  const id = generateObjectId();
  const obj: WhiteboardObject = {
    id,
    type: 'stickyNote',
    x: pos.x,
    y: pos.y,
    width: 200,
    height: 140,
    strokeColor,
    strokeWidth,
    fillColor: '#facc15',
    fontSize: 16,
    textColor: strokeColor,
    text: 'Sticky note',
  };

  return { object: obj, selectIds: [id] };
}
