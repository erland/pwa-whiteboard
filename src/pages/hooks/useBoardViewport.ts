// src/pages/hooks/useBoardViewport.ts
import type React from 'react';
import type { Viewport } from '../../domain/types';

type UseBoardViewportArgs = {
  viewport: Viewport | undefined;
  setViewport: (patch: Partial<Viewport>) => void;
};

export function useBoardViewport({ viewport, setViewport }: UseBoardViewportArgs) {
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

  const handleResetView = () => {
    setViewport({ offsetX: 0, offsetY: 0, zoom: 1 });
  };

  return {
    zoomPercent,
    handleViewportChange,
    handleZoomChange,
    handleResetView
  };
}