// src/pages/hooks/useBoardViewport.ts
import type React from 'react';
import type { Viewport, WhiteboardObject } from '../../domain/types';
import { getBoundingBox } from '../../whiteboard/geometry';

type UseBoardViewportArgs = {
  viewport: Viewport | undefined;
  setViewport: (patch: Partial<Viewport>) => void;

  // Needed for "Fit".
  objects?: WhiteboardObject[];
  canvasWidth?: number;
  canvasHeight?: number;
};

export function useBoardViewport({
  viewport,
  setViewport,
  objects,
  canvasWidth,
  canvasHeight,
}: UseBoardViewportArgs) {
  const zoomPercent = Math.round((viewport?.zoom ?? 1) * 100);

  const handleViewportChange = (patch: Partial<Viewport>) => {
    setViewport(patch);
  };

  const handleZoomChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const value = Number(e.target.value);
    const zoom = value / 100;
    if (zoom > 0 && zoom <= 4) {
      setViewport({ zoom });
    }
  };

  /**
   * Fit: zoom/pan so all objects are visible in the canvas.
   *
   * Notes:
   * - Uses union bounding box across all objects (in world coords).
   * - Clamps zoom to the UI range (25%–200%).
   * - Adds a bit of padding around content.
   */
  const handleFitView = () => {
    const cw = canvasWidth ?? 960;
    const ch = canvasHeight ?? 540;

    if (!objects || objects.length === 0) {
      setViewport({ offsetX: 0, offsetY: 0, zoom: 1 });
      return;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const obj of objects) {
      const b = getBoundingBox(obj, objects);
      if (!b) continue;
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      setViewport({ offsetX: 0, offsetY: 0, zoom: 1 });
      return;
    }

    const contentW = Math.max(1e-6, maxX - minX);
    const contentH = Math.max(1e-6, maxY - minY);

    const padPx = 40; // canvas pixels
    const availW = Math.max(1, cw - padPx * 2);
    const availH = Math.max(1, ch - padPx * 2);

    let zoom = Math.min(availW / contentW, availH / contentH);
    // Clamp to zoom range: 5%–400% (Fit may need <25%)
    zoom = Math.max(0.05, Math.min(4, zoom));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // worldToCanvas: (world + offset) * zoom
    const offsetX = cw / (2 * zoom) - centerX;
    const offsetY = ch / (2 * zoom) - centerY;

    setViewport({ offsetX, offsetY, zoom });
  };

  return {
    zoomPercent,
    handleViewportChange,
    handleZoomChange,
    handleFitView,
  };
}
