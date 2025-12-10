// src/whiteboard/WhiteboardCanvas.tsx
import React, { useEffect, useRef } from 'react';
import type { WhiteboardCanvasProps } from './whiteboardTypes';
import { useCanvasDrawing } from './useCanvasDrawing';
import { useCanvasInteractions } from './useCanvasInteractions';

// Re-export so other modules can keep importing from this file.
export type { DrawingTool } from './whiteboardTypes';

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = (props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Notify parent about the canvas element so it can be used for image export.
  useEffect(() => {
    if (props.onCanvasReady) {
      props.onCanvasReady(canvasRef.current);
    }
  }, [props.onCanvasReady]);

  const {
    draft,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave
  } = useCanvasInteractions({
    objects: props.objects,
    selectedObjectIds: props.selectedObjectIds,
    viewport: props.viewport,
    activeTool: props.activeTool,
    strokeColor: props.strokeColor,
    strokeWidth: props.strokeWidth,
    onCreateObject: props.onCreateObject,
    onSelectionChange: props.onSelectionChange,
    onUpdateObject: props.onUpdateObject,
    onViewportChange: props.onViewportChange
  });

  useCanvasDrawing({
    canvasRef,
    width: props.width,
    height: props.height,
    objects: props.objects,
    selectedObjectIds: props.selectedObjectIds,
    viewport: props.viewport,
    draft,
    strokeColor: props.strokeColor
  });

  return (
    <canvas
      ref={canvasRef}
      className="whiteboard-canvas"
      style={{ width: props.width, height: props.height, touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    />
  );
};