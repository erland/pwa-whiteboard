// src/whiteboard/interactions/drag/types.ts
import type { ObjectId, WhiteboardObject } from '../../../domain/types';
import type { Bounds, ResizeHandleId } from '../../geometry';

export type ResizeDragState = {
  kind: 'resize';
  objectId: ObjectId;
  handle: ResizeHandleId;
  startX: number; // world coords at pointer-down
  startY: number;
  originalBounds: Bounds;
  originalObject: WhiteboardObject;
  lastPatch?: Partial<WhiteboardObject> | null;
};

export type MoveDragState = {
  kind: 'move';
  objectId: ObjectId;
  startX: number; // world coords at pointer-down
  startY: number;
  originalObject: WhiteboardObject;
  lastPatch?: Partial<WhiteboardObject> | null;
};

export type PanDragState = {
  kind: 'pan';
  startCanvasX: number;
  startCanvasY: number;
  startOffsetX: number;
  startOffsetY: number;
  zoomAtStart: number;
};

export type ConnectorEndpointDragState = {
  kind: 'connectorEndpoint';
  objectId: ObjectId;
  endpoint: 'from' | 'to';
  originalObject: WhiteboardObject;
  lastPatch?: Partial<WhiteboardObject> | null;
};

export type LineEndpointDragState = {
  kind: 'lineEndpoint';
  objectId: ObjectId;
  endpoint: 'start' | 'end';
  originalObject: WhiteboardObject;
  lastPatch?: Partial<WhiteboardObject> | null;
};

export type DragState =
  | MoveDragState
  | PanDragState
  | ResizeDragState
  | ConnectorEndpointDragState
  | LineEndpointDragState;

export type DragCommit = {
  objectId: ObjectId;
  patch: Partial<WhiteboardObject>;
};
