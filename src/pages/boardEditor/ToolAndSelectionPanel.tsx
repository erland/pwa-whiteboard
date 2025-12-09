import React from 'react';
import type { DrawingTool } from '../../whiteboard/WhiteboardCanvas';
import type { WhiteboardObject } from '../../domain/types';

function getSharedProp<K extends keyof WhiteboardObject>(
  objects: WhiteboardObject[],
  key: K
): WhiteboardObject[K] | undefined {
  if (objects.length === 0) return undefined;
  const first = objects[0][key];
  if (first === undefined) {
    return undefined;
  }
  for (const obj of objects) {
    if (obj[key] !== first) {
      return undefined;
    }
  }
  return first;
}

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
  const selectedCount = selectedObjects.length;

  const isSingleTextSelected =
    selectedCount === 1 && selectedObjects[0].type === 'text';
  const isSingleStickySelected =
    selectedCount === 1 && selectedObjects[0].type === 'stickyNote';
  const singleSelectedObject =
    isSingleTextSelected || isSingleStickySelected ? selectedObjects[0] : undefined;
  const isAllTextSelection =
    selectedCount > 0 && selectedObjects.every((obj) => obj.type === 'text');

  const sharedStrokeColor = getSharedProp(selectedObjects, 'strokeColor') as
    | string
    | undefined;
  const sharedStrokeWidth = getSharedProp(selectedObjects, 'strokeWidth') as
    | number
    | undefined;
  const sharedFillColor = getSharedProp(selectedObjects, 'fillColor') as
    | string
    | undefined;
  const sharedFontSize = getSharedProp(selectedObjects, 'fontSize') as
    | number
    | undefined;
  const sharedText = getSharedProp(selectedObjects, 'text') as string | undefined;
  const sharedTextColor = getSharedProp(selectedObjects, 'textColor') as
    | string
    | undefined;

  return (
    <div className="panel">
      <h2 className="panel-title">Tool &amp; Selection</h2>

      {/* Freehand / Rectangle / Ellipse: stroke settings */}
      {(activeTool === 'freehand' ||
        activeTool === 'rectangle' ||
        activeTool === 'ellipse') && (
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
          <div className="panel-row">
            <label className="field-label">
              Stroke width
              <input
                type="range"
                min={1}
                max={10}
                value={strokeWidth}
                onChange={onStrokeWidthChange}
              />
              <span className="field-suffix">{strokeWidth}px</span>
            </label>
          </div>
        </>
      )}

      {/* Text tool: Text color + Font size + Text (for selected text) */}
      {activeTool === 'text' && (
        <>
          {isSingleTextSelected && singleSelectedObject ? (
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
          ) : (
            <div className="panel-row">
              <span className="field-value">
                Select a text object on the board to edit its text, text color and font size.
              </span>
            </div>
          )}
        </>
      )}

      {/* Sticky note tool: Stroke + Fill + Text color + Font + Text */}
      {activeTool === 'stickyNote' && (
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
      )}

      {/* Select tool: Delete + shared properties (incl. Text color) */}
      {activeTool === 'select' && (
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

          {/* Hide stroke controls if the selection is purely Text objects */}
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
      )}
    </div>
  );
};