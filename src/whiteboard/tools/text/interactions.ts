import type { WhiteboardObject, ObjectId, Point } from '../../../domain/types';

export type TextStartArgs = {
  pos: Point;
  strokeColor: string;
  strokeWidth: number;
  textColor?: string;
  fontSize?: number;
  text?: string;
  generateObjectId: () => ObjectId;
};

export function createTextObject({ pos, strokeColor, strokeWidth, textColor, fontSize, text, generateObjectId }: TextStartArgs): {
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
    textColor: textColor ?? strokeColor,
    strokeWidth,
    fontSize: fontSize ?? 18,
    text: text ?? 'Text',
  };

  return { object: obj, selectIds: [id] };
}
