import React from 'react';
import type { ToolInstanceDefinition, ToolInstanceId } from '../../whiteboard/boardTypes';

type ToolSelectorPanelProps = {
  toolbox: readonly ToolInstanceDefinition[];
  activeToolInstanceId: ToolInstanceId;
  onChangeToolInstance: (id: ToolInstanceId) => void;
};

export const ToolSelectorPanel: React.FC<ToolSelectorPanelProps> = ({
  toolbox,
  activeToolInstanceId,
  onChangeToolInstance,
}) => (
  <div className="panel">
    <h2 className="panel-title panel-title-tools">Tools</h2>

    <div className="tool-grid">
      {toolbox.map((tool) => (
        <button
          key={tool.id}
          type="button"
          className={`tool-button ${activeToolInstanceId === tool.id ? 'active' : ''}`}
          onClick={() => onChangeToolInstance(tool.id)}
          aria-pressed={activeToolInstanceId === tool.id}
        >
          {tool.icon ? `${tool.icon} ` : ''}
          {tool.label}
        </button>
      ))}
    </div>
  </div>
);
