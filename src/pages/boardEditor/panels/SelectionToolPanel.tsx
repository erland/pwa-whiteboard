// src/pages/boardEditor/panels/SelectionToolPanel.tsx
import React from 'react';
import type { WhiteboardObject } from '../../../domain/types';
import type { SelectionDetails } from '../useSelectionDetails';
import { EDITABLE_PROP_DEFS, type EditablePropKey } from '../../../whiteboard/tools/selectionRegistry';

type Props = {
  selection: SelectionDetails;
  updateSelectionProp: <K extends keyof WhiteboardObject>(
    key: K,
    value: WhiteboardObject[K]
  ) => void;
};

function hasValue<T>(v: T | undefined | null): v is T {
  return v !== undefined && v !== null;
}

function renderEditablePropControl(
  key: EditablePropKey,
  value: unknown,
  disabled: boolean,
  updateSelectionProp: <K extends keyof WhiteboardObject>(
    k: K,
    v: WhiteboardObject[K]
  ) => void
): React.ReactNode {
  const def = EDITABLE_PROP_DEFS[key];

  if (def.control.kind === 'color') {
    const v = typeof value === 'string' ? value : '#000000';
    return (
      <div className="panel-row" key={key}>
        <label className="field-label">
          <span className="field-label-inline">{def.label}</span>
          <input
            className="color-input"
            type="color"
            value={v}
            disabled={disabled}
            onChange={(e) => updateSelectionProp(key as any, e.target.value as any)}
            aria-label={def.label}
          />
        </label>
      </div>
    );
  }

  if (def.control.kind === 'range') {
    const n = typeof value === 'number' ? value : def.control.min;
    return (
      <div className="panel-row" key={key}>
        <label className="field-label">
          <span className="field-label-inline">{def.label}</span>
          <span className="field-value">{n}</span>
        </label>
        <input
          type="range"
          min={def.control.min}
          max={def.control.max}
          step={def.control.step}
          value={n}
          disabled={disabled}
          onChange={(e) => updateSelectionProp(key as any, Number(e.target.value) as any)}
          style={{ width: '100%' }}
          aria-label={def.label}
        />
      </div>
    );
  }


  if (def.control.kind === 'select') {
    const opts = def.control.options;
    const v = typeof value === 'string' ? value : (opts[0]?.value ?? '');
    return (
      <div className="panel-row" key={key}>
        <label className="field-label">
          <span className="field-label-inline">{def.label}</span>
          <select
            className="text-input"
            value={v}
            disabled={disabled}
            onChange={(e) => updateSelectionProp(key as any, e.target.value as any)}
            aria-label={def.label}
          >
            {opts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }  if (def.control.kind === 'boolean') {
    const checked = Boolean(value);
    return (
      <div className="panel-row" key={key}>
        <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => updateSelectionProp(key as any, e.target.checked as any)}
            aria-label={def.label}
          />
          <span className="field-label-inline">{def.label}</span>
        </label>
      </div>
    );
  }

  // textarea is handled separately (we only show it for single selection)
  return null;
}

export const SelectionToolPanel: React.FC<Props> = ({
  selection,
  updateSelectionProp
}) => {
  const hasSelection = selection.selectedCount > 0;
  const singleObj = selection.singleAnySelectedObject;

  // Policy-derived locked keys are provided by useSelectionDetails.
  // Hidden keys are already filtered out from selection.commonEditableProps.
  const lockedKeys = new Set(selection.lockedEditableProps);

  const singleCanEditText =
    selection.selectedCount === 1 &&
    selection.commonEditableProps.includes('text') &&
    singleObj !== undefined;

  return (
    <div>
      <div className="panel-row">
        <span className="field-label-inline">Selected</span>
        <span className="field-value">
          {hasSelection ? selection.selectedCount : 0}
        </span>
      </div>

      {/* Capability-driven shared props across the current selection */}
      {selection.commonEditableProps
        .filter((k) => k !== 'text')
        .map((key) => {
          const shared = selection.sharedEditableValues[key];
          if (!hasValue(shared as any)) return null;
          return renderEditablePropControl(key, shared, lockedKeys.has(key), updateSelectionProp);
        })}

      {/* Capability-driven text editing (only for single selection, to preserve v1 UX) */}
      {singleCanEditText && (
        <div className="panel-row">
          <div style={{ width: '100%' }}>
            <div className="field-label-inline" style={{ marginBottom: 6 }}>
              {EDITABLE_PROP_DEFS.text.label}
            </div>
            <textarea
              className="text-input"
              value={(singleObj?.text ?? '') as string}
              disabled={lockedKeys.has('text')}
              onChange={(e) => updateSelectionProp('text' as any, e.target.value as any)}
            />
          </div>
        </div>
      )}
    </div>
  );
};