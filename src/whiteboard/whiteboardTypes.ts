// src/whiteboard/whiteboardTypes.ts
import type { WhiteboardObject, Viewport, ObjectId } from '../domain/types';

export type DrawingTool =
  | 'select'
  | 'freehand'
  | 'rectangle'
  | 'ellipse'
  | 'text'
  | 'stickyNote';

export interface WhiteboardCanvasProps {
  width: number;
  height: number;
  objects: WhiteboardObject[];
  selectedObjectIds: ObjectId[];
  viewport: Viewport;
  activeTool: DrawingTool;
  strokeColor: string;
  strokeWidth: number;
  onCreateObject: (object: WhiteboardObject) => void;
  onSelectionChange: (selectedIds: ObjectId[]) => void;
  onUpdateObject: (objectId: ObjectId, patch: Partial<WhiteboardObject>) => void;
  onViewportChange: (patch: Partial<Viewport>) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}