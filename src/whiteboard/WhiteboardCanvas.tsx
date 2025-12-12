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
    handlePointerLeave,
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
    onViewportChange: props.onViewportChange,
  });

  useCanvasDrawing({
    canvasRef,
    width: props.width,
    height: props.height,
    objects: props.objects,
    selectedObjectIds: props.selectedObjectIds,
    viewport: props.viewport,
    draft,
    strokeColor: props.strokeColor,
  });

  // ─────────────────────────────────────────────
  // Native touch events (like PatternCanvas)
  // ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Build a minimal "pointer-like" event object from a Touch
    const makeFakePointerEvent = (
      touch: Touch | null
    ): React.PointerEvent<HTMLCanvasElement> => {
      const anyEvt: any = {
        clientX: touch?.clientX ?? 0,
        clientY: touch?.clientY ?? 0,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'touch',
        target: canvas,
        currentTarget: canvas,
        preventDefault: () => {},
      };
      return anyEvt as React.PointerEvent<HTMLCanvasElement>;
    };

    const handleTouchStart = (ev: TouchEvent) => {
      if (ev.touches.length === 0) return;
      ev.preventDefault();
      const t = ev.touches[0];
      handlePointerDown(makeFakePointerEvent(t));
    };

    const handleTouchMove = (ev: TouchEvent) => {
      if (ev.touches.length === 0) return;
      ev.preventDefault();
      const t = ev.touches[0];
      handlePointerMove(makeFakePointerEvent(t));
    };

    const handleTouchEnd = (ev: TouchEvent) => {
      ev.preventDefault();
      // We don't care about exact coordinates on up; just finish interaction.
      handlePointerUp(makeFakePointerEvent(null));
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handlePointerDown, handlePointerMove, handlePointerUp]);

  // ─────────────────────────────────────────────
  // Pointer events for mouse / pen (desktop)
  // ─────────────────────────────────────────────

  const handlePointerDownReact = (
    evt: React.PointerEvent<HTMLCanvasElement>
  ) => {
    // Ignore touch pointer events here; real touch is handled via native listeners.
    if (evt.pointerType === 'touch') return;
    handlePointerDown(evt);
  };

  const handlePointerMoveReact = (
    evt: React.PointerEvent<HTMLCanvasElement>
  ) => {
    if (evt.pointerType === 'touch') return;
    handlePointerMove(evt);
  };

  const handlePointerUpReact = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    if (evt.pointerType === 'touch') return;
    handlePointerUp(evt);
  };

  const handlePointerLeaveReact = (
    evt: React.PointerEvent<HTMLCanvasElement>
  ) => {
    if (evt.pointerType === 'touch') return;
    handlePointerLeave(evt);
  };

  return (
    <canvas
      ref={canvasRef}
      className="whiteboard-canvas"
      style={{ width: props.width, height: props.height, touchAction: 'none' }}
      onPointerDown={handlePointerDownReact}
      onPointerMove={handlePointerMoveReact}
      onPointerUp={handlePointerUpReact}
      onPointerLeave={handlePointerLeaveReact}
    />
  );
};