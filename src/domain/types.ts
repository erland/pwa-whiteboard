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
  | 'diamond'
  | 'roundedRect'
  | 'text'
  | 'stickyNote'
  | 'connector';

export interface Point {
  x: number;
  y: number;
}

/**
 * Attachment model for connectors (future-proof for modeling-style connections).
 *
 * - port: explicit named port on an object (later: shapes like process arrow can expose ports)
 * - edgeT: parameterized point along a rectangle-like edge, t in [0..1]
 * - perimeterAngle: angle on perimeter (useful for ellipse/circle and other radial shapes)
 * - fallback: simple anchor for early implementation / degraded cases
 */
export type Attachment =
  | { type: 'port'; portId: string }
  | { type: 'edgeT'; edge: 'top' | 'right' | 'bottom' | 'left'; t: number }
  | { type: 'perimeterAngle'; angleRad: number }
  | {
      type: 'fallback';
      anchor: 'center' | 'top' | 'right' | 'bottom' | 'left';
    };

export interface ConnectorEnd {
  objectId: ObjectId;
  attachment: Attachment;
}

/**
 * Base representation of an object on the board.
 * For v1:
 * - freehand: uses `points` (and derives a loose bounding box from x/y/width/height)
 * - rectangle/ellipse: use x, y, width, height
 * - text/stickyNote: use x, y and optional width/height + text/fontSize
 *
 * For connectors (new):
 * - type: 'connector'
 * - uses `from` and `to` to reference connected objects
 * - style uses strokeColor/strokeWidth
 * - x/y/width/height are not required for connectors (kept for structural compatibility)
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
  cornerRadius?: number;
  strokeWidth?: number;

  // Text content (for text / sticky notes)
  text?: string;
  fontSize?: number;
  textColor?: string;

  // Freehand path (board coordinates)
  points?: Point[];

  // Connector endpoints (only for type === 'connector')
  from?: ConnectorEnd;
  to?: ConnectorEnd;

  // Reserved for later routing modes (not used in v1 implementation)
  routing?: 'straight' | 'manual' | 'orthogonal';
  waypoints?: Point[];
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