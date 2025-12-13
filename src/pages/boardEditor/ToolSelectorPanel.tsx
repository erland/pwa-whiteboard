import React from 'react';
import type { DrawingTool } from '../../whiteboard/whiteboardTypes';
import { TOOL_REGISTRY } from '../../whiteboard/tools/registry';

type ToolSelectorPanelProps = {
  activeTool: DrawingTool;
  onChangeTool: (tool: DrawingTool) => void;
};

export const ToolSelectorPanel: React.FC<ToolSelectorPanelProps> = ({
  activeTool,
  onChangeTool,
}) => (
  <div className="panel">
    <h2 className="panel-title panel-title-tools">Tools</h2>

    <div className="tool-buttons">
      {TOOL_REGISTRY.map((tool) => (
        <button
          key={tool.id}
          type="button"
          className={`tool-button ${activeTool === tool.id ? 'active' : ''}`}
          onClick={() => onChangeTool(tool.id as DrawingTool)}
          aria-pressed={activeTool === tool.id}
        >
          {tool.icon ? `${tool.icon} ` : ''}
          {tool.label}
        </button>
      ))}
    </div>
  </div>
);