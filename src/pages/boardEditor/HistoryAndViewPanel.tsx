import React from 'react';

type HistoryAndViewPanelProps = {
  canUndo: boolean;
  canRedo: boolean;
  zoomPercent: number;
  onUndo: () => void;
  onRedo: () => void;
  onZoomChange: React.ChangeEventHandler<HTMLInputElement>;
  onResetView: () => void;
};

export const HistoryAndViewPanel: React.FC<HistoryAndViewPanelProps> = ({
  canUndo,
  canRedo,
  zoomPercent,
  onUndo,
  onRedo,
  onZoomChange,
  onResetView
}) => (
  <div className="panel">
    <h2 className="panel-title">History &amp; View</h2>
    <div className="panel-row">
      <button
        type="button"
        className="tool-button"
        disabled={!canUndo}
        onClick={onUndo}
      >
        ⬅ Undo
      </button>
      <button
        type="button"
        className="tool-button"
        disabled={!canRedo}
        onClick={onRedo}
      >
        Redo ➜
      </button>
    </div>
    <div className="panel-row">
      <label className="field-label">
        Zoom
        <input
          type="range"
          min={25}
          max={200}
          value={zoomPercent}
          onChange={onZoomChange}
        />
        <span className="field-suffix">{zoomPercent}%</span>
      </label>
    </div>
    <div className="panel-row">
      <button
        type="button"
        className="tool-button"
        onClick={onResetView}
      >
        Reset view
      </button>
    </div>
  </div>
);