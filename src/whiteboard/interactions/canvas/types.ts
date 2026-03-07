import type { DraftShape } from '../../drawing';
import type { Point, Viewport, WhiteboardObject, ObjectId } from '../../../domain/types';
import type { DrawingTool } from '../../whiteboardTypes';
import type { DragState } from '../drag/types';

export type CanvasToolContext = {
  objects: WhiteboardObject[];
  viewport: Viewport;
  strokeColor: string;
  strokeWidth: number;
  toolProps?: Partial<WhiteboardObject>;
  generateObjectId: () => ObjectId;
};

export type CanvasPointerHelpers = {
  getCanvasPos: (evt: React.PointerEvent<HTMLCanvasElement>) => Point;
  getCanvasXY: (evt: React.PointerEvent<HTMLCanvasElement>) => { canvasX: number; canvasY: number };
  setPointerCaptureSafe: (evt: React.PointerEvent<HTMLCanvasElement>) => void;
  releasePointerCaptureSafe: (evt: React.PointerEvent<HTMLCanvasElement>) => void;
};

export type CanvasInteractionsDeps = {
  objects: WhiteboardObject[];
  selectedObjectIds: ObjectId[];
  viewport: Viewport;
  activeTool: DrawingTool;
  onCreateObject: (object: WhiteboardObject) => void;
  onSelectionChange: (selectedIds: ObjectId[]) => void;
  onUpdateObject: (objectId: ObjectId, patch: Partial<WhiteboardObject>) => void;
  onTransientObjectPatch: (objectId: ObjectId, patch: Partial<WhiteboardObject>) => void;
  onViewportChange: (patch: Partial<Viewport>) => void;
  onCursorWorldMove?: (pos: { x: number; y: number }) => void;
  toolCtx: CanvasToolContext;
  draft: DraftShape | null;
  drag: DragState | null;
  setDraft: (draft: DraftShape | null) => void;
  setDrag: (drag: DragState | null) => void;
};
