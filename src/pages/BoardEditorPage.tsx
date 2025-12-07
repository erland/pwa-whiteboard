import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWhiteboard } from '../whiteboard/WhiteboardStore';
import type { WhiteboardMeta, WhiteboardObject, BoardEvent, Viewport } from '../domain/types';
import { WhiteboardCanvas, type DrawingTool } from '../whiteboard/WhiteboardCanvas';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

function generateEventId(): string {
  return 'evt_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
}

export const BoardEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { state, resetBoard, dispatchEvent, undo, redo, setViewport } = useWhiteboard();

  const [activeTool, setActiveTool] = useState<DrawingTool>('freehand');
  const [strokeColor, setStrokeColor] = useState<string>('#38bdf8');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!id) return;

    if (!state || state.meta.id !== id) {
      const now = new Date().toISOString();
      const meta: WhiteboardMeta = {
        id,
        name: `Board ${id}`,
        createdAt: now,
        updatedAt: now
      };
      resetBoard(meta);
    }
  }, [id, state, resetBoard]);

  const handleCreateObject = (object: WhiteboardObject) => {
    if (!state) return;
    const now = new Date().toISOString();
    const event: BoardEvent = {
      id: generateEventId(),
      boardId: state.meta.id,
      type: 'objectCreated',
      timestamp: now,
      payload: { object }
    } as BoardEvent;
    dispatchEvent(event);
  };

  const handleSelectionChange = (selectedIds: string[]) => {
    if (!state) return;
    const now = new Date().toISOString();
    const event: BoardEvent = {
      id: generateEventId(),
      boardId: state.meta.id,
      type: 'selectionChanged',
      timestamp: now,
      payload: { selectedIds }
    } as BoardEvent;
    dispatchEvent(event);
  };

  const handleUpdateObject = (objectId: string, patch: Partial<WhiteboardObject>) => {
    if (!state) return;
    const now = new Date().toISOString();
    const event: BoardEvent = {
      id: generateEventId(),
      boardId: state.meta.id,
      type: 'objectUpdated',
      timestamp: now,
      payload: { objectId, patch }
    } as BoardEvent;
    dispatchEvent(event);
  };

  const handleDeleteSelection = () => {
    if (!state || state.selectedObjectIds.length === 0) return;
    const count = state.selectedObjectIds.length;
    const confirmed = window.confirm(
      `Delete ${count} selected object${count === 1 ? '' : 's'}? This cannot be undone.`
    );
    if (!confirmed) return;

    const now = new Date().toISOString();
    state.selectedObjectIds.forEach((objectId) => {
      const event: BoardEvent = {
        id: generateEventId(),
        boardId: state.meta.id,
        type: 'objectDeleted',
        timestamp: now,
        payload: { objectId }
      } as BoardEvent;
      dispatchEvent(event);
    });

    const clearEvent: BoardEvent = {
      id: generateEventId(),
      boardId: state.meta.id,
      type: 'selectionChanged',
      timestamp: new Date().toISOString(),
      payload: { selectedIds: [] }
    } as BoardEvent;
    dispatchEvent(clearEvent);
  };

  const handleApplyStrokeToSelection = () => {
    if (!state || state.selectedObjectIds.length === 0) return;
    const now = new Date().toISOString();
    state.selectedObjectIds.forEach((objectId) => {
      const event: BoardEvent = {
        id: generateEventId(),
        boardId: state.meta.id,
        type: 'objectUpdated',
        timestamp: now,
        payload: {
          objectId,
          patch: {
            strokeColor,
            strokeWidth
          }
        }
      } as BoardEvent;
      dispatchEvent(event);
    });
  };

  const handleStrokeWidthChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const value = Number(e.target.value);
    if (!Number.isNaN(value) && value > 0 && value <= 20) {
      setStrokeWidth(value);
    }
  };

  const handleViewportChange = (patch: Partial<Viewport>) => {
    setViewport(patch);
  };

  const zoomPercent = Math.round(((state?.viewport.zoom ?? 1) * 100));

  const handleZoomChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const value = Number(e.target.value);
    const zoom = value / 100;
    if (zoom > 0 && zoom <= 4) {
      setViewport({ zoom });
    }
  };

  const handleResetView = () => {
    setViewport({ offsetX: 0, offsetY: 0, zoom: 1 });
  };

  const handleExportJson = () => {
    if (!state) return;
    const exportData = {
      version: 1,
      boardId: state.meta.id,
      meta: state.meta,
      objects: state.objects,
      viewport: state.viewport
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const safeName = state.meta.name?.replace(/[^a-z0-9_-]+/gi, '_') || 'whiteboard';
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.whiteboard.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPng = () => {
    if (!canvasEl || !state) return;
    try {
      const dataUrl = canvasEl.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      const safeName = state.meta.name?.replace(/[^a-z0-9_-]+/gi, '_') || 'whiteboard';
      a.download = `${safeName}.png`;
      a.click();
    } catch (err) {
      console.error('Failed to export PNG', err);
      window.alert('Could not export image. See console for details.');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !state) {
      return;
    }
    try {
      const text = await file.text();
      const data: any = JSON.parse(text);

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid JSON');
      }
      if (!Array.isArray(data.objects)) {
        throw new Error('File does not contain a valid objects array');
      }

      const now = new Date().toISOString();
      const importedMeta = (data.meta ?? {}) as Partial<WhiteboardMeta>;
      const newMeta: WhiteboardMeta = {
        ...state.meta,
        ...importedMeta,
        id: state.meta.id,
        updatedAt: now
      };

      // Reset board with new meta, then recreate objects via events so history is consistent
      resetBoard(newMeta);

      const objects = data.objects as WhiteboardObject[];
      const boardId = newMeta.id;

      for (const obj of objects) {
        const event: BoardEvent = {
          id: generateEventId(),
          boardId,
          type: 'objectCreated',
          timestamp: now,
          payload: { object: obj }
        } as BoardEvent;
        dispatchEvent(event);
      }

      if (data.viewport) {
        const vp = data.viewport as Viewport;
        setViewport(vp);
      }

      window.alert('Board imported successfully.');
    } catch (err) {
      console.error('Failed to import board', err);
      window.alert('Could not import board JSON. Please check the file format.');
    } finally {
      e.target.value = '';
    }
  };

  const selectedCount = state?.selectedObjectIds.length ?? 0;
  const selectedObject =
    state && state.selectedObjectIds.length === 1
      ? state.objects.find((obj) => obj.id === state.selectedObjectIds[0])
      : undefined;

  const canUndo = !!state && state.history.pastEvents.length > 0;
  const canRedo = !!state && state.history.futureEvents.length > 0;

  return (
    <section className="page page-board-editor">
      <header className="page-header">
        <h1>Board editor</h1>
        <div className="page-header-actions">
          <span className="page-subtitle">Board ID: {id}</span>
          <Link to="/">← Back to boards</Link>
        </div>
      </header>

      <div className="board-editor-layout">
        <aside className="board-editor-sidebar">
          <div className="panel">
            <h2 className="panel-title">History &amp; View</h2>
            <div className="panel-row">
              <button
                type="button"
                className="tool-button"
                disabled={!canUndo}
                onClick={undo}
              >
                ⬅ Undo
              </button>
              <button
                type="button"
                className="tool-button"
                disabled={!canRedo}
                onClick={redo}
              >
                Redo ➜
              </button>
            </div>
            <div className="panel-row">
              <label className="field-label">
                Zoom
                <input
                  type="range"
                  min={25}
                  max={200}
                  value={zoomPercent}
                  onChange={handleZoomChange}
                />
                <span className="field-suffix">{zoomPercent}%</span>
              </label>
            </div>
            <div className="panel-row">
              <button
                type="button"
                className="tool-button"
                onClick={handleResetView}
              >
                Reset view
              </button>
            </div>
          </div>

          <div className="panel">
            <h2 className="panel-title">Export &amp; Import</h2>
            <div className="panel-row">
              <button
                type="button"
                className="tool-button"
                onClick={handleExportJson}
                disabled={!state}
              >
                Export board (JSON)
              </button>
            </div>
            <div className="panel-row">
              <button
                type="button"
                className="tool-button"
                onClick={handleExportPng}
                disabled={!state}
              >
                Export view (PNG)
              </button>
            </div>
            <div className="panel-row">
              <button
                type="button"
                className="tool-button"
                onClick={handleImportClick}
              >
                Import board (JSON)
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                style={{ display: 'none' }}
                onChange={handleImportFileChange}
              />
            </div>
          </div>

          <div className="panel">
            <h2 className="panel-title">Tools</h2>
            <div className="tool-buttons">
              <button
                type="button"
                className={`tool-button ${activeTool === 'freehand' ? 'active' : ''}`}
                onClick={() => setActiveTool('freehand')}
              >
                ✏️ Freehand
              </button>
              <button
                type="button"
                className={`tool-button ${activeTool === 'rectangle' ? 'active' : ''}`}
                onClick={() => setActiveTool('rectangle')}
              >
                ▭ Rectangle
              </button>
              <button
                type="button"
                className={`tool-button ${activeTool === 'ellipse' ? 'active' : ''}`}
                onClick={() => setActiveTool('ellipse')}
              >
                ◯ Ellipse
              </button>
              <button
                type="button"
                className={`tool-button ${activeTool === 'text' ? 'active' : ''}`}
                onClick={() => setActiveTool('text')}
              >
                🔤 Text
              </button>
              <button
                type="button"
                className={`tool-button ${activeTool === 'stickyNote' ? 'active' : ''}`}
                onClick={() => setActiveTool('stickyNote')}
              >
                🗒 Sticky note
              </button>
              <button
                type="button"
                className={`tool-button ${activeTool === 'select' ? 'active' : ''}`}
                onClick={() => setActiveTool('select')}
              >
                🖱 Select
              </button>
            </div>
          </div>

          <div className="panel">
            <h2 className="panel-title">Stroke</h2>
            <div className="panel-row">
              <label className="field-label">
                Color
                <input
                  type="color"
                  value={strokeColor}
                  onChange={(e) => setStrokeColor(e.target.value)}
                  className="color-input"
                />
              </label>
            </div>
            <div className="panel-row">
              <label className="field-label">
                Width
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={strokeWidth}
                  onChange={handleStrokeWidthChange}
                />
                <span className="field-suffix">{strokeWidth}px</span>
              </label>
            </div>
          </div>

          {state && (
            <div className="panel">
              <h2 className="panel-title">Board info</h2>
              <div className="panel-row">
                <span className="field-label-inline">Name</span>
                <span className="field-value">{state.meta.name}</span>
              </div>
              <div className="panel-row">
                <span className="field-label-inline">Objects</span>
                <span className="field-value">{state.objects.length}</span>
              </div>
            </div>
          )}

          {state && (
            <div className="panel">
              <h2 className="panel-title">Selection</h2>
              <div className="panel-row">
                <span className="field-label-inline">Selected</span>
                <span className="field-value">{selectedCount}</span>
              </div>
              <div className="panel-row">
                <button
                  type="button"
                  className="tool-button"
                  disabled={selectedCount === 0}
                  onClick={handleApplyStrokeToSelection}
                >
                  Apply stroke to selection
                </button>
              </div>
              <div className="panel-row">
                <button
                  type="button"
                  className="tool-button"
                  disabled={selectedCount === 0}
                  onClick={handleDeleteSelection}
                >
                  Delete selection
                </button>
              </div>

              {selectedObject && (selectedObject.type === 'text' || selectedObject.type === 'stickyNote') && (
                <>
                  <div className="panel-row">
                    <label className="field-label">
                      Text
                      <textarea
                        className="text-input"
                        rows={3}
                        value={selectedObject.text ?? ''}
                        onChange={(e) =>
                          handleUpdateObject(selectedObject.id, {
                            text: e.target.value
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
                        value={selectedObject.fontSize ?? 16}
                        onChange={(e) =>
                          handleUpdateObject(selectedObject.id, {
                            fontSize: Number(e.target.value)
                          })
                        }
                      />
                      <span className="field-suffix">
                        {(selectedObject.fontSize ?? 16) as number}px
                      </span>
                    </label>
                  </div>
                  {selectedObject.type === 'stickyNote' && (
                    <div className="panel-row">
                      <label className="field-label">
                        Note color
                        <input
                          type="color"
                          className="color-input"
                          value={selectedObject.fillColor ?? '#facc15'}
                          onChange={(e) =>
                            handleUpdateObject(selectedObject.id, {
                              fillColor: e.target.value
                            })
                          }
                        />
                      </label>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </aside>

        <div className="board-editor-main">
          {state ? (
            <WhiteboardCanvas
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              objects={state.objects}
              selectedObjectIds={state.selectedObjectIds}
              viewport={state.viewport}
              activeTool={activeTool}
              strokeColor={strokeColor}
              strokeWidth={strokeWidth}
              onCreateObject={handleCreateObject}
              onSelectionChange={handleSelectionChange}
              onUpdateObject={handleUpdateObject}
              onViewportChange={handleViewportChange}
              onCanvasReady={setCanvasEl}
            />
          ) : (
            <div className="board-editor-placeholder">
              <p>Loading board…</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};