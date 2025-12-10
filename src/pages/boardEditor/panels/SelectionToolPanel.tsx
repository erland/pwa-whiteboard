// src/pages/boardEditor/panels/SelectionToolPanel.tsx
import React from 'react';
import type { WhiteboardObject } from '../../../domain/types';
import type { SelectionDetails } from '../useSelectionDetails';

type SelectionToolPanelProps = {
  selection: SelectionDetails;
  onDeleteSelection: () => void;
  updateSelectionProp: <K extends keyof WhiteboardObject>(
    key: K,
    value: WhiteboardObject[K]
  ) => void;
};

export const SelectionToolPanel: React.FC<SelectionToolPanelProps> = ({
  selection,
  onDeleteSelection,
  updateSelectionProp
}) => {
  const {
    selectedCount,
    isAllTextSelection,
    sharedStrokeColor,
    sharedStrokeWidth,
    sharedFillColor,
    sharedTextColor,
    sharedFontSize,
    sharedText
  } = selection;

  return (
    <>
      <div className="panel-row">
        <span className="field-label-inline">Selected</span>
        <span className="field-value">{selectedCount}</span>
      </div>
      <div className="panel-row">
        <button
          type="button"
          className="tool-button"
          disabled={selectedCount === 0}
          onClick={onDeleteSelection}
        >
          Delete selection
        </button>
      </div>

      {!isAllTextSelection && sharedStrokeColor !== undefined && (
        <div className="panel-row">
          <label className="field-label">
            Stroke color
            <input
              type="color"
              className="color-input"
              value={sharedStrokeColor}
              onChange={(e) => updateSelectionProp('strokeColor', e.target.value)}
            />
          </label>
        </div>
      )}

      {!isAllTextSelection && sharedStrokeWidth !== undefined && (
        <div className="panel-row">
          <label className="field-label">
            Stroke width
            <input
              type="range"
              min={1}
              max={10}
              value={sharedStrokeWidth}
              onChange={(e) =>
                updateSelectionProp('strokeWidth', Number(e.target.value))
              }
            />
            <span className="field-suffix">{sharedStrokeWidth}px</span>
          </label>
        </div>
      )}

      {sharedFillColor !== undefined && (
        <div className="panel-row">
          <label className="field-label">
            Fill color
            <input
              type="color"
              className="color-input"
              value={sharedFillColor}
              onChange={(e) => updateSelectionProp('fillColor', e.target.value)}
            />
          </label>
        </div>
      )}

      {sharedTextColor !== undefined && (
        <div className="panel-row">
          <label className="field-label">
            Text color
            <input
              type="color"
              className="color-input"
              value={sharedTextColor}
              onChange={(e) => updateSelectionProp('textColor', e.target.value)}
            />
          </label>
        </div>
      )}

      {sharedFontSize !== undefined && (
        <div className="panel-row">
          <label className="field-label">
            Font size
            <input
              type="range"
              min={10}
              max={40}
              value={sharedFontSize}
              onChange={(e) =>
                updateSelectionProp('fontSize', Number(e.target.value))
              }
            />
            <span className="field-suffix">{sharedFontSize}px</span>
          </label>
        </div>
      )}

      {sharedText !== undefined && (
        <div className="panel-row">
          <label className="field-label">
            Text
            <textarea
              className="text-input"
              rows={3}
              value={sharedText}
              onChange={(e) => updateSelectionProp('text', e.target.value)}
            />
          </label>
        </div>
      )}
    </>
  );
};