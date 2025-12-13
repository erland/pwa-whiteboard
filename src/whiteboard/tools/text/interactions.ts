import type { WhiteboardObject, ObjectId, Point } from '../../../domain/types';

export type TextStartArgs = {
  pos: Point;
  strokeColor: string;
  strokeWidth: number;
  generateObjectId: () => ObjectId;
};

export function createTextObject({ pos, strokeColor, strokeWidth, generateObjectId }: TextStartArgs): {
  object: WhiteboardObject;
  selectIds: ObjectId[];
} {
  const id = generateObjectId();
  const obj: WhiteboardObject = {
    id,
    type: 'text',
    x: pos.x,
    y: pos.y,
    width: 200,
    height: 40,
    strokeColor,
    textColor: strokeColor,
    strokeWidth,
    fontSize: 18,
    text: 'Text',
  };

  return { object: obj, selectIds: [id] };
}
