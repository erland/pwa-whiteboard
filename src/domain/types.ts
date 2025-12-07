export type WhiteboardId = string;
export type ObjectId = string;
export type BoardEventId = string;

export interface WhiteboardMeta {
  id: WhiteboardId;
  name: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export type WhiteboardObjectType =
  | 'freehand'
  | 'rectangle'
  | 'ellipse'
  | 'text'
  | 'stickyNote';

/**
 * Base representation of an object on the board.
 * Specific tools may use fields differently, but this is enough for v1.
 */
export interface WhiteboardObject {
  id: ObjectId;
  type: WhiteboardObjectType;

  // Position
  x: number;
  y: number;

  // Size (for rectangle/ellipse/stickyNote). Freehand may ignore this or use bounds.
  width?: number;
  height?: number;

  // Style
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;

  // Text content (for text / sticky notes)
  text?: string;
  fontSize?: number;
}

export interface Viewport {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export interface HistoryState {
  pastEvents: BoardEvent[];
  futureEvents: BoardEvent[];
}

/**
 * Full in-memory state of a whiteboard.
 * For v1 there is a single local user, but the model is future-proof for collaboration.
 */
export interface WhiteboardState {
  meta: WhiteboardMeta;
  objects: WhiteboardObject[];
  selectedObjectIds: ObjectId[];
  viewport: Viewport;
  history: HistoryState;
}

export type BoardEventType =
  | 'objectCreated'
  | 'objectUpdated'
  | 'objectDeleted'
  | 'selectionChanged'
  | 'viewportChanged';

export interface BaseBoardEvent {
  id: BoardEventId;
  boardId: WhiteboardId;
  type: BoardEventType;
  timestamp: string; // ISO
}

export interface ObjectCreatedEvent extends BaseBoardEvent {
  type: 'objectCreated';
  payload: {
    object: WhiteboardObject;
  };
}

export interface ObjectUpdatedEvent extends BaseBoardEvent {
  type: 'objectUpdated';
  payload: {
    objectId: ObjectId;
    patch: Partial<WhiteboardObject>;
  };
}

export interface ObjectDeletedEvent extends BaseBoardEvent {
  type: 'objectDeleted';
  payload: {
    objectId: ObjectId;
  };
}

export interface SelectionChangedEvent extends BaseBoardEvent {
  type: 'selectionChanged';
  payload: {
    selectedIds: ObjectId[];
  };
}

export interface ViewportChangedEvent extends BaseBoardEvent {
  type: 'viewportChanged';
  payload: {
    viewport: Partial<Viewport>;
  };
}

export type BoardEvent =
  | ObjectCreatedEvent
  | ObjectUpdatedEvent
  | ObjectDeletedEvent
  | SelectionChangedEvent
  | ViewportChangedEvent;
