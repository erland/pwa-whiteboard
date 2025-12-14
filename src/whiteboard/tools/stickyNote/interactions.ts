import type { WhiteboardObject, ObjectId, Point } from '../../../domain/types';

export type StickyNoteStartArgs = {
  pos: Point;
  strokeColor: string;
  strokeWidth: number;
  fillColor?: string;
  textColor?: string;
  fontSize?: number;
  text?: string;
  generateObjectId: () => ObjectId;
};

export function createStickyNoteObject({
  pos,
  strokeColor,
  strokeWidth,
  fillColor,
  textColor,
  fontSize,
  text,
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
    fillColor: fillColor ?? '#facc15',
    fontSize: fontSize ?? 16,
    textColor: textColor ?? strokeColor,
    text: text ?? 'Sticky note',
  };

  return { object: obj, selectIds: [id] };
}
