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

export interface Point {
  x: number;
  y: number;
}

/**
 * Base representation of an object on the board.
 * For v1:
 * - freehand: uses `points` (and derives a loose bounding box from x/y/width/height)
 * - rectangle/ellipse: use x, y, width, height
 * - text/stickyNote: use x, y and optional width/height + text/fontSize
 */
export interface WhiteboardObject {
  id: ObjectId;
  type: WhiteboardObjectType;

  // Anchor position in board coordinates
  x: number;
  y: number;

  // Size (for rectangle/ellipse/stickyNote). Freehand uses this as a loose bounding box.
  width?: number;
  height?: number;

  // Style
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;

  // Text content (for text / sticky notes)
  text?: string;
  fontSize?: number;

  // Freehand path (board coordinates)
  points?: Point[];
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
