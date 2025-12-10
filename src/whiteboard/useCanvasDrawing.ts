// src/whiteboard/useCanvasDrawing.ts
import { useEffect } from 'react';
import type React from 'react';
import type { WhiteboardObject, Viewport, ObjectId } from '../domain/types';
import type { DraftShape } from './drawing';
import { drawObjectsWithSelection, drawDraftShape } from './drawing';

type CanvasDrawingParams = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  width: number;
  height: number;
  objects: WhiteboardObject[];
  selectedObjectIds: ObjectId[];
  viewport: Viewport;
  draft: DraftShape | null;
  strokeColor: string;
};

export function useCanvasDrawing({
  canvasRef,
  width,
  height,
  objects,
  selectedObjectIds,
  viewport,
  draft,
  strokeColor
}: CanvasDrawingParams) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // Clear and background
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    // Draw all objects + selection overlays
    drawObjectsWithSelection(ctx, objects, selectedObjectIds, viewport, strokeColor);

    // Draw draft shape on top
    if (draft) {
      drawDraftShape(ctx, draft, viewport);
    }
  }, [canvasRef, width, height, objects, selectedObjectIds, viewport, draft, strokeColor]);
}