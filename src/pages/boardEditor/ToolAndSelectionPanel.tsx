// src/pages/boardEditor/ToolAndSelectionPanel.tsx
import React from 'react';
import type { DrawingTool } from '../../whiteboard/WhiteboardCanvas';
import type { WhiteboardObject } from '../../domain/types';
import { useSelectionDetails } from './useSelectionDetails';
import { ToolSettingsPanel } from './panels/ToolSettingsPanel';
import { SelectionToolPanel } from './panels/SelectionToolPanel';

type ToolAndSelectionPanelProps = {
  activeTool: DrawingTool;
  strokeColor: string;
  strokeWidth: number;
  toolProps: Partial<WhiteboardObject>;
  onStrokeColorChange: (color: string) => void;
  onStrokeWidthChange: (value: number) => void;
  onUpdateToolProp: <K extends keyof WhiteboardObject>(
    key: K,
    value: WhiteboardObject[K]
  ) => void;
  selectedObjects: WhiteboardObject[];
  onDeleteSelection: () => void;
  updateSelectionProp: <K extends keyof WhiteboardObject>(
    key: K,
    value: WhiteboardObject[K]
  ) => void;
};

export const ToolAndSelectionPanel: React.FC<ToolAndSelectionPanelProps> = ({
  activeTool,
  strokeColor,
  strokeWidth,
  toolProps,
  onStrokeColorChange,
  onStrokeWidthChange,
  onUpdateToolProp,
  selectedObjects,
  onDeleteSelection,
  updateSelectionProp
}) => {
  const selection = useSelectionDetails(selectedObjects);

  return (
    <div className="panel">
      <h2 className="panel-title">Tool &amp; Selection</h2>

      {activeTool !== 'select' && (
        <ToolSettingsPanel
          activeTool={activeTool}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          toolProps={toolProps}
          onStrokeColorChange={onStrokeColorChange}
          onStrokeWidthChange={onStrokeWidthChange}
          onUpdateToolProp={onUpdateToolProp}
        />
      )}

      {activeTool === 'select' && (
        <SelectionToolPanel
          selection={selection}
          onDeleteSelection={onDeleteSelection}
          updateSelectionProp={updateSelectionProp}
        />
      )}
    </div>
  );
};