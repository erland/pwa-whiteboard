// src/pages/boardEditor/panels/TextToolPanel.tsx
import React from 'react';
import type { WhiteboardObject } from '../../../domain/types';
import type { SelectionDetails } from '../useSelectionDetails';

type TextToolPanelProps = {
  selection: SelectionDetails;
  strokeColor: string;
  onUpdateObject: (objectId: string, patch: Partial<WhiteboardObject>) => void;
};

export const TextToolPanel: React.FC<TextToolPanelProps> = ({
  selection,
  strokeColor,
  onUpdateObject
}) => {
  const { isSingleTextSelected, singleSelectedObject } = selection;

  if (!isSingleTextSelected || !singleSelectedObject) {
    return (
      <div className="panel-row">
        <span className="field-value">
          Select a text object on the board to edit its text, text color and font size.
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="panel-row">
        <label className="field-label">
          Text color
          <input
            type="color"
            className="color-input"
            value={singleSelectedObject.textColor ?? strokeColor}
            onChange={(e) =>
              onUpdateObject(singleSelectedObject.id, {
                textColor: e.target.value
              })
            }
          />
        </label>
      </div>
      <div className="panel-row">
        <label className="field-label">
          Font size
          <input
            type="range"
            min={10}
            max={40}
            value={singleSelectedObject.fontSize ?? 16}
            onChange={(e) =>
              onUpdateObject(singleSelectedObject.id, {
                fontSize: Number(e.target.value)
              })
            }
          />
          <span className="field-suffix">
            {(singleSelectedObject.fontSize ?? 16) as number}px
          </span>
        </label>
      </div>
      <div className="panel-row">
        <label className="field-label">
          Text
          <textarea
            className="text-input"
            rows={3}
            value={singleSelectedObject.text ?? ''}
            onChange={(e) =>
              onUpdateObject(singleSelectedObject.id, {
                text: e.target.value
              })
            }
          />
        </label>
      </div>
    </>
  );
};