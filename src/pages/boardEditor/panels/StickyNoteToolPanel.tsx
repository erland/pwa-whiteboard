// src/pages/boardEditor/panels/StickyNoteToolPanel.tsx
import React from 'react';
import type { WhiteboardObject } from '../../../domain/types';
import type { SelectionDetails } from '../useSelectionDetails';

type StickyNoteToolPanelProps = {
  selection: SelectionDetails;
  strokeColor: string;
  onStrokeColorChange: (color: string) => void;
  onUpdateObject: (objectId: string, patch: Partial<WhiteboardObject>) => void;
};

export const StickyNoteToolPanel: React.FC<StickyNoteToolPanelProps> = ({
  selection,
  strokeColor,
  onStrokeColorChange,
  onUpdateObject
}) => {
  const { isSingleStickySelected, singleSelectedObject } = selection;

  return (
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

      {isSingleStickySelected && singleSelectedObject ? (
        <>
          <div className="panel-row">
            <label className="field-label">
              Fill color
              <input
                type="color"
                className="color-input"
                value={singleSelectedObject.fillColor ?? '#facc15'}
                onChange={(e) =>
                  onUpdateObject(singleSelectedObject.id, {
                    fillColor: e.target.value
                  })
                }
              />
            </label>
          </div>
          <div className="panel-row">
            <label className="field-label">
              Text color
              <input
                type="color"
                className="color-input"
                value={singleSelectedObject.textColor ?? '#0f172a'}
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
      ) : (
        <div className="panel-row">
          <span className="field-value">
            Select a sticky note to edit its fill color, text color, text and font size.
          </span>
        </div>
      )}
    </>
  );
};