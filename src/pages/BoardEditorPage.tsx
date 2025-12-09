import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useWhiteboard } from '../whiteboard/WhiteboardStore';
import type {
  WhiteboardMeta,
  WhiteboardObject,
  BoardEvent,
  Viewport
} from '../domain/types';
import { getWhiteboardRepository } from '../infrastructure/localStorageWhiteboardRepository';
import { WhiteboardCanvas, type DrawingTool } from '../whiteboard/WhiteboardCanvas';

import { BoardEditorHeader } from './boardEditor/BoardEditorHeader';
import { HistoryAndViewPanel } from './boardEditor/HistoryAndViewPanel';
import { ExportImportPanel } from './boardEditor/ExportImportPanel';
import { ToolSelectorPanel } from './boardEditor/ToolSelectorPanel';
import { ToolAndSelectionPanel } from './boardEditor/ToolAndSelectionPanel';
import { BoardInfoPanel } from './boardEditor/BoardInfoPanel';

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

    // If we already have the correct board loaded, do nothing.
    if (state && state.meta.id === id) {
      return;
    }

    let cancelled = false;
    const repo = getWhiteboardRepository();

    (async () => {
      try {
        const existing = await repo.loadBoard(id);
        if (cancelled) return;

        if (existing) {
          // Load persisted state
          resetBoard(existing);
          return;
        }

        // No persisted state found → create a fresh board
        const now = new Date().toISOString();
        const meta: WhiteboardMeta = {
          id,
          name: `Board ${id}`,
          createdAt: now,
          updatedAt: now
        };
        resetBoard(meta);
      } catch (err) {
        console.error('Failed to load board state', err);
        const now = new Date().toISOString();
        const meta: WhiteboardMeta = {
          id,
          name: `Board ${id}`,
          createdAt: now,
          updatedAt: now
        };
        resetBoard(meta);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, state?.meta.id, resetBoard]);

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

  const handleStrokeWidthChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const value = Number(e.target.value);
    if (!Number.isNaN(value) && value > 0 && value <= 20) {
      setStrokeWidth(value);
    }
  };

  const handleViewportChange = (patch: Partial<Viewport>) => {
    setViewport(patch);
  };

  const zoomPercent = Math.round((state?.viewport.zoom ?? 1) * 100);

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

  // Selection-related helpers
  const selectedObjects: WhiteboardObject[] =
    state && state.selectedObjectIds.length > 0
      ? state.objects.filter((obj) => state.selectedObjectIds.includes(obj.id))
      : [];

  const updateSelectionProp: <K extends keyof WhiteboardObject>(
    key: K,
    value: WhiteboardObject[K]
  ) => void = (key, value) => {
    if (!state || selectedObjects.length === 0) return;
    const now = new Date().toISOString();
    selectedObjects.forEach((obj) => {
      const event: BoardEvent = {
        id: generateEventId(),
        boardId: state.meta.id,
        type: 'objectUpdated',
        timestamp: now,
        payload: {
          objectId: obj.id,
          patch: { [key]: value } as Partial<WhiteboardObject>
        }
      } as BoardEvent;
      dispatchEvent(event);
    });
  };

  const canUndo = !!state && state.history.pastEvents.length > 0;
  const canRedo = !!state && state.history.futureEvents.length > 0;

  return (
    <section className="page page-board-editor">
      <BoardEditorHeader boardId={id} />

      <div className="board-editor-layout">
        <aside className="board-editor-sidebar">
          <HistoryAndViewPanel
            canUndo={canUndo}
            canRedo={canRedo}
            zoomPercent={zoomPercent}
            onUndo={undo}
            onRedo={redo}
            onZoomChange={handleZoomChange}
            onResetView={handleResetView}
          />

          <ExportImportPanel
            canExport={!!state}
            onExportJson={handleExportJson}
            onExportPng={handleExportPng}
            onImportClick={handleImportClick}
            fileInputRef={fileInputRef}
            onImportFileChange={handleImportFileChange}
          />

          <ToolSelectorPanel
            activeTool={activeTool}
            onChangeTool={setActiveTool}
          />

          <ToolAndSelectionPanel
            activeTool={activeTool}
            strokeColor={strokeColor}
            strokeWidth={strokeWidth}
            onStrokeColorChange={setStrokeColor}
            onStrokeWidthChange={handleStrokeWidthChange}
            selectedObjects={selectedObjects}
            onUpdateObject={handleUpdateObject}
            onDeleteSelection={handleDeleteSelection}
            updateSelectionProp={updateSelectionProp}
          />

          {state && (
            <BoardInfoPanel
              meta={state.meta}
              objectCount={state.objects.length}
            />
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