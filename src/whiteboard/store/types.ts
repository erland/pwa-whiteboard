import type {
  BoardEvent,
  ObjectId,
  Viewport,
  WhiteboardObject,
  WhiteboardState,
} from '../../domain/types';

export type WhiteboardAction =
  | { type: 'RESET_BOARD'; state: WhiteboardState }
  | { type: 'APPLY_EVENT'; event: BoardEvent }
  | { type: 'APPLY_REMOTE_EVENT'; event: BoardEvent }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_VIEWPORT'; patch: Partial<Viewport> }
  | { type: 'APPLY_TRANSIENT_OBJECT_PATCH'; objectId: ObjectId; patch: Partial<WhiteboardObject> };
