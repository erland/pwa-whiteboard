// src/pages/hooks/useBoardEditor.ts
import React, { useEffect, useState } from 'react';
import { useWhiteboard } from '../../whiteboard/WhiteboardStore';
import type {
  WhiteboardMeta,
  WhiteboardObject,
  BoardEvent
} from '../../domain/types';
import { getWhiteboardRepository } from '../../infrastructure/localStorageWhiteboardRepository';
import { getBoardsRepository } from '../../infrastructure/localStorageBoardsRepository';
import type { DrawingTool } from '../../whiteboard/WhiteboardCanvas';
import { generateEventId } from './boardEvents';
import { useBoardViewport } from './useBoardViewport';
import { useBoardSelection } from './useBoardSelection';
import { useBoardImportExport } from './useBoardImportExport';

export function useBoardEditor(id: string | undefined) {
  const { state, resetBoard, dispatchEvent, undo, redo, setViewport } = useWhiteboard();

  const [activeTool, setActiveTool] = useState<DrawingTool>('freehand');
  const [strokeColor, setStrokeColor] = useState<string>('#38bdf8');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);

  // ---- Board loading / initialization ----
  useEffect(() => {
    if (!id) return;

    // If we already have the correct board loaded, do nothing.
    if (state && state.meta.id === id) {
      return;
    }

    let cancelled = false;
    const repo = getWhiteboardRepository();
    const boardsRepo = getBoardsRepository();

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
        const index = await boardsRepo.listBoards();
        const indexMeta = index.find((m) => m.id === id) ?? null;

        const now = new Date().toISOString();
        const meta: WhiteboardMeta = {
          id,
          name: indexMeta?.name ?? 'Untitled board',
          createdAt: indexMeta?.createdAt ?? now,
          updatedAt: now,
        };

        resetBoard(meta);
      } catch (err) {
        console.error('Failed to load board state', err);

        try {
          // Best-effort: still try to respect the index name in the error path
          const index = await boardsRepo.listBoards();
          const indexMeta = index.find((m) => m.id === id) ?? null;

          const now = new Date().toISOString();
          const meta: WhiteboardMeta = {
            id,
            name: indexMeta?.name ?? 'Untitled board',
            createdAt: indexMeta?.createdAt ?? now,
            updatedAt: now,
          };

          if (!cancelled) {
            resetBoard(meta);
          }
        } catch {
          // Absolute fallback if even the index fails
          if (!cancelled) {
            const now = new Date().toISOString();
            const meta: WhiteboardMeta = {
              id,
              name: 'Untitled board',
              createdAt: now,
              updatedAt: now,
            };
            resetBoard(meta);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, state?.meta.id, resetBoard]);

  // ---- Object events (create / update) ----

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

  const handleStrokeWidthChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const value = Number(e.target.value);
    if (!Number.isNaN(value) && value > 0 && value <= 20) {
      setStrokeWidth(value);
    }
  };

  // ---- Sub-hooks ----

  const {
    zoomPercent,
    handleViewportChange,
    handleZoomChange,
    handleResetView
  } = useBoardViewport({
    viewport: state?.viewport,
    setViewport
  });

  const {
    selectedObjects,
    handleSelectionChange,
    handleDeleteSelection,
    updateSelectionProp
  } = useBoardSelection({
    state,
    dispatchEvent
  });

  const {
    fileInputRef,
    handleExportJson,
    handleExportPng,
    handleImportClick,
    handleImportFileChange
  } = useBoardImportExport({
    state,
    canvasEl,
    resetBoard,
    dispatchEvent,
    setViewport
  });

  const canUndo = !!state && state.history.pastEvents.length > 0;
  const canRedo = !!state && state.history.futureEvents.length > 0;

  return {
    state,
    activeTool,
    setActiveTool,
    strokeColor,
    setStrokeColor,
    strokeWidth,
    setStrokeWidth,
    canvasEl,
    setCanvasEl,
    fileInputRef,
    handleCreateObject,
    handleSelectionChange,
    handleUpdateObject,
    handleDeleteSelection,
    handleStrokeWidthChange,
    handleViewportChange,
    zoomPercent,
    handleZoomChange,
    handleResetView,
    handleExportJson,
    handleExportPng,
    handleImportClick,
    handleImportFileChange,
    selectedObjects,
    updateSelectionProp,
    canUndo,
    canRedo,
    undo,
    redo
  };
}