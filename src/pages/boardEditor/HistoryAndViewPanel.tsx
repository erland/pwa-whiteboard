import React from 'react';

type HistoryAndViewPanelProps = {
  canUndo: boolean;
  canRedo: boolean;
  zoomPercent: number;
  onUndo: () => void;
  onRedo: () => void;
  onZoomChange: React.ChangeEventHandler<HTMLInputElement>;
  onFitView: () => void;
};

/**
 * Compact inline controls row placed above the canvas.
 * No "History & View" caption and no "Zoom"/"100%" text to limit height.
 */
export const HistoryAndViewPanel: React.FC<HistoryAndViewPanelProps> = ({
  canUndo,
  canRedo,
  zoomPercent,
  onUndo,
  onRedo,
  onZoomChange,
  onFitView,
}) => {
  return (
    <div className="board-editor-top-controls">
      {/* Left side: undo / redo */}
      <div className="board-editor-top-controls-left">
        <button
          type="button"
          className="tool-button board-editor-top-button"
          disabled={!canUndo}
          onClick={onUndo}
        >
          ⟲ Undo
        </button>
        <button
          type="button"
          className="tool-button board-editor-top-button"
          disabled={!canRedo}
          onClick={onRedo}
        >
          ⟳ Redo
        </button>
      </div>

      {/* Right side: zoom + fit, still compact */}
      <div className="board-editor-top-controls-right">
        <span className="board-editor-zoom-icon">−</span>
        <input
          type="range"
          min={5}
          max={200}
          step={5}
          value={zoomPercent}
          onChange={onZoomChange}
          className="board-editor-zoom-range"
          aria-label="Zoom"
        />
        <span className="board-editor-zoom-icon">+</span>
        <button
          type="button"
          className="tool-button board-editor-top-button board-editor-fit-button"
          onClick={onFitView}
        >
          Fit
        </button>
      </div>
    </div>
  );
};
