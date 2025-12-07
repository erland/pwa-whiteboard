import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWhiteboard } from '../whiteboard/WhiteboardStore';
import type { WhiteboardMeta, WhiteboardObject, BoardEvent } from '../domain/types';
import { WhiteboardCanvas, type DrawingTool } from '../whiteboard/WhiteboardCanvas';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

function generateEventId(): string {
  return 'evt_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
}

export const BoardEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { state, resetBoard, dispatchEvent } = useWhiteboard();

  const [activeTool, setActiveTool] = useState<DrawingTool>('freehand');
  const [strokeColor, setStrokeColor] = useState<string>('#38bdf8');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);

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

  const handleStrokeWidthChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const value = Number(e.target.value);
    if (!Number.isNaN(value) && value > 0 && value <= 20) {
      setStrokeWidth(value);
    }
  };

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
                className={`tool-button ${activeTool === 'select' ? 'active' : ''}`}
                onClick={() => setActiveTool('select')}
              >
                🖱 Select (preview)
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
        </aside>

        <div className="board-editor-main">
          {state ? (
            <WhiteboardCanvas
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              objects={state.objects}
              viewport={state.viewport}
              activeTool={activeTool}
              strokeColor={strokeColor}
              strokeWidth={strokeWidth}
              onCreateObject={handleCreateObject}
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
