// src/whiteboard/useCanvasInteractions.ts
import { useState } from 'react';
import type React from 'react';
import type { WhiteboardObject, Viewport, ObjectId } from '../domain/types';
import type { DraftShape } from './drawing';
import type { DrawingTool } from './whiteboardTypes';
import type { DragState } from './interactions/drag/types';
import {
  createCanvasPointerHelpers,
  finishSelectInteraction,
  finishToolInteraction,
  handleSelectPointerDown,
  handleSelectPointerMove,
  handleToolPointerDown,
  handleToolPointerMove,
  leaveToolInteraction,
} from './interactions/canvas';

export type CanvasInteractionsParams = {
  objects: WhiteboardObject[];
  selectedObjectIds: ObjectId[];
  viewport: Viewport;
  activeTool: DrawingTool;
  strokeColor: string;
  strokeWidth: number;
  toolProps?: Partial<WhiteboardObject>;
  onCreateObject: (object: WhiteboardObject) => void;
  onSelectionChange: (selectedIds: ObjectId[]) => void;
  onUpdateObject: (objectId: ObjectId, patch: Partial<WhiteboardObject>) => void;
  /** Live interaction patch (drag/resize) that should NOT create an undo step. */
  onTransientObjectPatch: (objectId: ObjectId, patch: Partial<WhiteboardObject>) => void;
  onViewportChange: (patch: Partial<Viewport>) => void;
  onCursorWorldMove?: (pos: { x: number; y: number }) => void;
  canvasWidth: number;
  canvasHeight: number;
};

export type CanvasInteractionsResult = {
  draft: DraftShape | null;
  handlePointerDown: (evt: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerMove: (evt: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerUp: (evt: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerLeave: (evt: React.PointerEvent<HTMLCanvasElement>) => void;
};

export function useCanvasInteractions({
  objects,
  selectedObjectIds,
  viewport,
  activeTool,
  strokeColor,
  strokeWidth,
  toolProps,
  onCreateObject,
  onSelectionChange,
  onUpdateObject,
  onTransientObjectPatch,
  onViewportChange,
  onCursorWorldMove,
  canvasWidth,
  canvasHeight,
}: CanvasInteractionsParams): CanvasInteractionsResult {
  const [draft, setDraft] = useState<DraftShape | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const generateObjectId = () =>
    ('o_' +
      Math.random().toString(16).slice(2) +
      '_' +
      Date.now().toString(16)) as ObjectId;

  const pointer = createCanvasPointerHelpers(viewport, canvasWidth, canvasHeight);

  const deps = {
    objects,
    selectedObjectIds,
    viewport,
    activeTool,
    onCreateObject,
    onSelectionChange,
    onUpdateObject,
    onTransientObjectPatch,
    onViewportChange,
    onCursorWorldMove,
    toolCtx: {
      objects,
      viewport,
      strokeColor,
      strokeWidth,
      toolProps,
      generateObjectId,
    },
    draft,
    drag,
    setDraft,
    setDrag,
  };

  const handlePointerDown = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    if (evt.pointerType === 'mouse' && evt.button !== 0) return;

    const pos = pointer.getCanvasPos(evt);
    onCursorWorldMove?.(pos);

    if (handleToolPointerDown(deps, pos)) {
      if (activeTool !== 'select' && deps.draft !== draft) {
        // no-op: state setter already enqueued
      }
      if (activeTool !== 'select') pointer.setPointerCaptureSafe(evt);
      return;
    }

    const { canvasX, canvasY } = pointer.getCanvasXY(evt);
    if (handleSelectPointerDown(deps, pos, canvasX, canvasY)) {
      pointer.setPointerCaptureSafe(evt);
    }
  };

  const handlePointerMove = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = pointer.getCanvasPos(evt);
    onCursorWorldMove?.(pos);

    if (handleToolPointerMove(deps, pos)) return;

    if (!drag || activeTool !== 'select') return;
    const { canvasX, canvasY } = pointer.getCanvasXY(evt);
    handleSelectPointerMove(deps, pos, canvasX, canvasY);
  };

  const handlePointerUp = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = pointer.getCanvasPos(evt);
    onCursorWorldMove?.(pos);

    if (finishToolInteraction(deps, pos)) {
      pointer.releasePointerCaptureSafe(evt);
      return;
    }

    if (finishSelectInteraction(deps)) {
      pointer.releasePointerCaptureSafe(evt);
    }
  };

  const handlePointerLeave = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = pointer.getCanvasPos(evt);
    onCursorWorldMove?.(pos);

    if (leaveToolInteraction(deps, pos)) {
      pointer.releasePointerCaptureSafe(evt);
      return;
    }

    if (finishSelectInteraction(deps)) {
      pointer.releasePointerCaptureSafe(evt);
    }
  };

  return {
    draft,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
  };
}
