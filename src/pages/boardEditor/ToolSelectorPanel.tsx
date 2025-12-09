import React from 'react';
import type { DrawingTool } from '../../whiteboard/WhiteboardCanvas';

type ToolSelectorPanelProps = {
  activeTool: DrawingTool;
  onChangeTool: (tool: DrawingTool) => void;
};

export const ToolSelectorPanel: React.FC<ToolSelectorPanelProps> = ({
  activeTool,
  onChangeTool
}) => (
  <div className="panel">
    <h2 className="panel-title">Tools</h2>
    <div className="tool-buttons">
      <button
        type="button"
        className={`tool-button ${activeTool === 'freehand' ? 'active' : ''}`}
        onClick={() => onChangeTool('freehand')}
      >
        ✏️ Freehand
      </button>
      <button
        type="button"
        className={`tool-button ${activeTool === 'rectangle' ? 'active' : ''}`}
        onClick={() => onChangeTool('rectangle')}
      >
        ▭ Rectangle
      </button>
      <button
        type="button"
        className={`tool-button ${activeTool === 'ellipse' ? 'active' : ''}`}
        onClick={() => onChangeTool('ellipse')}
      >
        ◯ Ellipse
      </button>
      <button
        type="button"
        className={`tool-button ${activeTool === 'text' ? 'active' : ''}`}
        onClick={() => onChangeTool('text')}
      >
        🔤 Text
      </button>
      <button
        type="button"
        className={`tool-button ${activeTool === 'stickyNote' ? 'active' : ''}`}
        onClick={() => onChangeTool('stickyNote')}
      >
        🗒 Sticky note
      </button>
      <button
        type="button"
        className={`tool-button ${activeTool === 'select' ? 'active' : ''}`}
        onClick={() => onChangeTool('select')}
      >
        🖱 Select
      </button>
    </div>
  </div>
);