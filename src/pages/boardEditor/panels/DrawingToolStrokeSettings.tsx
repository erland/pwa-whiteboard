// src/pages/boardEditor/panels/DrawingToolStrokeSettings.tsx
import React from 'react';

type DrawingToolStrokeSettingsProps = {
  strokeColor: string;
  strokeWidth: number;
  onStrokeColorChange: (color: string) => void;
  onStrokeWidthChange: React.ChangeEventHandler<HTMLInputElement>;
};

export const DrawingToolStrokeSettings: React.FC<DrawingToolStrokeSettingsProps> = ({
  strokeColor,
  strokeWidth,
  onStrokeColorChange,
  onStrokeWidthChange
}) => (
  <>
    <div className="panel-row">
      <label className="field-label">
        Stroke color
        <input
          type="color"
          value={strokeColor}
          onChange={(e) => onStrokeColorChange(e.target.value)}
          className="color-input"
        />
      </label>
    </div>
    <div className="panel-row">
      <label className="field-label">
        Stroke width
        <input
          type="range"
          min={1}
          max={10}
          value={strokeWidth}
          onChange={onStrokeWidthChange}
        />
        <span className="field-suffix">{strokeWidth}px</span>
      </label>
    </div>
  </>
);