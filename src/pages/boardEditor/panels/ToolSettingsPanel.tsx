// src/pages/boardEditor/panels/ToolSettingsPanel.tsx
import React from 'react';
import type { WhiteboardObject } from '../../../domain/types';
import type { DrawingTool } from '../../../whiteboard/WhiteboardCanvas';
import type { ToolId } from '../../../whiteboard/tools/registry';
import {
  EDITABLE_PROP_DEFS,
  getSelectionCapabilities,
  type EditablePropKey,
} from '../../../whiteboard/tools/selectionRegistry';
import type { BoardTypeDefinition } from '../../../whiteboard/boardTypes';
import {
  getHiddenToolPropKeys,
  getLockedEditableKeys,
  getLockedToolProps,
} from '../../../whiteboard/boardTypes';

type Props = {
  boardTypeDef: BoardTypeDefinition;
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
};

function getToolPropValue(
  key: EditablePropKey,
  strokeColor: string,
  strokeWidth: number,
  toolProps: Partial<WhiteboardObject>
): unknown {
  if (key === 'strokeColor') return strokeColor;
  if (key === 'strokeWidth') return strokeWidth;
  return (toolProps as any)[key];
}

export const ToolSettingsPanel: React.FC<Props> = ({
  boardTypeDef,
  activeTool,
  strokeColor,
  strokeWidth,
  toolProps,
  onStrokeColorChange,
  onStrokeWidthChange,
  onUpdateToolProp,
}) => {
  if (activeTool === 'select') return null;

  const hiddenKeys = getHiddenToolPropKeys(boardTypeDef, activeTool as any as ToolId);
  const lockedKeys = getLockedEditableKeys(getLockedToolProps(boardTypeDef, activeTool as any as ToolId));

  // Tool ids match object types for all creation tools.
  const caps = getSelectionCapabilities(activeTool as any);
  const editableProps = (caps.editableProps ?? []).filter((k) => !hiddenKeys.has(k));

  if (editableProps.length === 0) {
    return (
      <div className="panel-row">
        <span className="field-value">No settings for this tool.</span>
      </div>
    );
  }

  return (
    <>
      {editableProps.map((key) => {
        const def = EDITABLE_PROP_DEFS[key];
        const value = getToolPropValue(key, strokeColor, strokeWidth, toolProps);
        const disabled = lockedKeys.has(key);

        if (def.control.kind === 'color') {
          // Match current selection UI behavior: don't show fill controls unless a fill is set.
          if (key === 'fillColor' && typeof value !== 'string') return null;

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
                  onChange={(e) => {
                    if (key === 'strokeColor') onStrokeColorChange(e.target.value);
                    else onUpdateToolProp(key as any, e.target.value as any);
                  }}
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
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (key === 'strokeWidth') onStrokeWidthChange(next);
                  else onUpdateToolProp(key as any, next as any);
                }}
                style={{ width: '100%' }}
                aria-label={def.label}
              />
            </div>
          );
        }

        if (def.control.kind === 'textarea') {
          const v = typeof value === 'string' ? value : '';
          return (
            <div className="panel-row" key={key}>
              <div style={{ width: '100%' }}>
                <div className="field-label-inline" style={{ marginBottom: 6 }}>
                  {def.label}
                </div>
                <textarea
                  className="text-input"
                  value={v}
                  disabled={disabled}
                  onChange={(e) => onUpdateToolProp(key as any, e.target.value as any)}
                />
              </div>
            </div>
          );
        }

        
        if (def.control.kind === 'select') {
          const opts = def.control.options;
          const v =
            typeof value === 'string'
              ? value
              : (opts[0]?.value ?? '');
          return (
            <div className="panel-row" key={key}>
              <label className="field-label">
                <span className="field-label-inline">{def.label}</span>
                <select
                  className="text-input"
                  value={v}
                  disabled={disabled}
                  onChange={(e) => onUpdateToolProp(key as any, e.target.value as any)}
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
        }        if (def.control.kind === 'boolean') {
          const checked = Boolean(value);
          return (
            <div className="panel-row" key={key}>
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) => onUpdateToolProp(key as any, e.target.checked as any)}
                  aria-label={def.label}
                />
                <span className="field-label-inline">{def.label}</span>
              </label>
            </div>
          );
        }

        return null;
      })}
    </>
  );
};
