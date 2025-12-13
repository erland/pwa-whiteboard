// src/pages/boardEditor/panels/SelectionToolPanel.tsx
import React from 'react';
import type { WhiteboardObject } from '../../../domain/types';
import type { SelectionDetails } from '../useSelectionDetails';

type Props = {
  selection: SelectionDetails;
  onDeleteSelection: () => void;
  updateSelectionProp: <K extends keyof WhiteboardObject>(
    key: K,
    value: WhiteboardObject[K]
  ) => void;
};

function hasValue<T>(v: T | undefined): v is T {
  return v !== undefined;
}

export const SelectionToolPanel: React.FC<Props> = ({
  selection,
  onDeleteSelection,
  updateSelectionProp
}) => {
  const hasSelection = selection.selectedCount > 0;

  return (
    <div>
      <div className="panel-row">
        <span className="field-label-inline">Selected</span>
        <span className="field-value">
          {hasSelection ? selection.selectedCount : 0}
        </span>
      </div>

      <div className="panel-row">
        <button
          type="button"
          className="tool-button"
          onClick={onDeleteSelection}
          disabled={!hasSelection}
          style={{ width: '100%' }}
        >
          🗑 Delete
        </button>
      </div>

      {/* Connector info (minimal, read-only) */}
      {selection.isSingleConnectorSelected && selection.singleConnectorObject && (
        <>
          <div className="panel-row" style={{ marginTop: 10 }}>
            <span className="field-label-inline">Type</span>
            <span className="field-value">Connector</span>
          </div>

          <div className="panel-row">
            <span className="field-label-inline">From</span>
            <span className="field-value">
              {selection.singleConnectorObject.from?.objectId ?? '—'}
            </span>
          </div>

          <div className="panel-row">
            <span className="field-label-inline">To</span>
            <span className="field-value">
              {selection.singleConnectorObject.to?.objectId ?? '—'}
            </span>
          </div>
        </>
      )}

      {/* Shared style props across selection */}
      {hasValue(selection.sharedStrokeColor) && (
        <div className="panel-row">
          <label className="field-label">
            <span className="field-label-inline">Stroke color</span>
            <input
              className="color-input"
              type="color"
              value={selection.sharedStrokeColor}
              onChange={(e) => updateSelectionProp('strokeColor', e.target.value)}
              aria-label="Stroke color"
            />
          </label>
        </div>
      )}

      {hasValue(selection.sharedStrokeWidth) && (
        <div className="panel-row">
          <label className="field-label">
            <span className="field-label-inline">Stroke width</span>
            <span className="field-value">{selection.sharedStrokeWidth}</span>
          </label>
          <input
            type="range"
            min={1}
            max={12}
            step={1}
            value={selection.sharedStrokeWidth}
            onChange={(e) =>
              updateSelectionProp('strokeWidth', Number(e.target.value))
            }
            style={{ width: '100%' }}
            aria-label="Stroke width"
          />
        </div>
      )}

      {hasValue(selection.sharedFillColor) && (
        <div className="panel-row">
          <label className="field-label">
            <span className="field-label-inline">Fill color</span>
            <input
              className="color-input"
              type="color"
              value={selection.sharedFillColor}
              onChange={(e) => updateSelectionProp('fillColor', e.target.value)}
              aria-label="Fill color"
            />
          </label>
        </div>
      )}

      {hasValue(selection.sharedTextColor) && (
        <div className="panel-row">
          <label className="field-label">
            <span className="field-label-inline">Text color</span>
            <input
              className="color-input"
              type="color"
              value={selection.sharedTextColor}
              onChange={(e) => updateSelectionProp('textColor', e.target.value)}
              aria-label="Text color"
            />
          </label>
        </div>
      )}

      {hasValue(selection.sharedFontSize) && (
        <div className="panel-row">
          <label className="field-label">
            <span className="field-label-inline">Font size</span>
            <span className="field-value">{selection.sharedFontSize}</span>
          </label>
          <input
            type="range"
            min={8}
            max={72}
            step={1}
            value={selection.sharedFontSize}
            onChange={(e) =>
              updateSelectionProp('fontSize', Number(e.target.value))
            }
            style={{ width: '100%' }}
            aria-label="Font size"
          />
        </div>
      )}

      {/* Single text/sticky: edit text (minimal) */}
      {(selection.isSingleTextSelected || selection.isSingleStickySelected) &&
        selection.singleSelectedObject && (
          <div className="panel-row">
            <div style={{ width: '100%' }}>
              <div className="field-label-inline" style={{ marginBottom: 6 }}>
                Text
              </div>
              <textarea
                className="text-input"
                value={selection.singleSelectedObject.text ?? ''}
                onChange={(e) => updateSelectionProp('text', e.target.value as any)}
              />
            </div>
          </div>
        )}
    </div>
  );
};