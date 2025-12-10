// src/pages/boardEditor/ToolAndSelectionPanel.tsx
import React from 'react';
import type { DrawingTool } from '../../whiteboard/WhiteboardCanvas';
import type { WhiteboardObject } from '../../domain/types';
import { useSelectionDetails } from './useSelectionDetails';
import { DrawingToolStrokeSettings } from './panels/DrawingToolStrokeSettings';
import { TextToolPanel } from './panels/TextToolPanel';
import { StickyNoteToolPanel } from './panels/StickyNoteToolPanel';
import { SelectionToolPanel } from './panels/SelectionToolPanel';

type ToolAndSelectionPanelProps = {
  activeTool: DrawingTool;
  strokeColor: string;
  strokeWidth: number;
  onStrokeColorChange: (color: string) => void;
  onStrokeWidthChange: React.ChangeEventHandler<HTMLInputElement>;
  selectedObjects: WhiteboardObject[];
  onUpdateObject: (objectId: string, patch: Partial<WhiteboardObject>) => void;
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
  onStrokeColorChange,
  onStrokeWidthChange,
  selectedObjects,
  onUpdateObject,
  onDeleteSelection,
  updateSelectionProp
}) => {
  const selection = useSelectionDetails(selectedObjects);

  return (
    <div className="panel">
      <h2 className="panel-title">Tool &amp; Selection</h2>

      {(activeTool === 'freehand' ||
        activeTool === 'rectangle' ||
        activeTool === 'ellipse') && (
        <DrawingToolStrokeSettings
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          onStrokeColorChange={onStrokeColorChange}
          onStrokeWidthChange={onStrokeWidthChange}
        />
      )}

      {activeTool === 'text' && (
        <TextToolPanel
          selection={selection}
          strokeColor={strokeColor}
          onUpdateObject={onUpdateObject}
        />
      )}

      {activeTool === 'stickyNote' && (
        <StickyNoteToolPanel
          selection={selection}
          strokeColor={strokeColor}
          onStrokeColorChange={onStrokeColorChange}
          onUpdateObject={onUpdateObject}
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