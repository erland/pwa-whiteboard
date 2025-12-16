// src/whiteboard/whiteboardTypes.ts
import type { WhiteboardObject, Viewport, ObjectId } from '../domain/types';

import type { ToolId } from './tools/registry';

export type DrawingTool = ToolId;

export interface WhiteboardCanvasProps {
  width: number;
  height: number;
  objects: WhiteboardObject[];
  selectedObjectIds: ObjectId[];
  viewport: Viewport;
  activeTool: DrawingTool;
  strokeColor: string;
  strokeWidth: number;
  /** Extra per-tool settings (e.g. roundedRect.cornerRadius, text.fontSize). */
  toolProps?: Partial<WhiteboardObject>;
  onCreateObject: (object: WhiteboardObject) => void;
  onSelectionChange: (selectedIds: ObjectId[]) => void;
  onUpdateObject: (objectId: ObjectId, patch: Partial<WhiteboardObject>) => void;
  /** Live interaction patch (drag/resize) that should NOT create an undo step. */
  onTransientObjectPatch: (objectId: ObjectId, patch: Partial<WhiteboardObject>) => void;
  onViewportChange: (patch: Partial<Viewport>) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}