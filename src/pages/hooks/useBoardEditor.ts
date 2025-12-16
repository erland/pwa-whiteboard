// src/pages/hooks/useBoardEditor.ts
import React, { useEffect, useMemo, useState } from 'react';
import { useWhiteboard } from '../../whiteboard/WhiteboardStore';
import type {
  WhiteboardMeta,
  WhiteboardObject,
  BoardEvent
} from '../../domain/types';
import { getWhiteboardRepository } from '../../infrastructure/localStorageWhiteboardRepository';
import { getBoardsRepository } from '../../infrastructure/localStorageBoardsRepository';
import type { DrawingTool } from '../../whiteboard/WhiteboardCanvas';
import {
  getBoardType,
  getLockedToolProps,
  getLockedObjectProps,
  getLockedEditableKeys,
  isEditablePropLocked,
} from '../../whiteboard/boardTypes';
import { generateEventId } from './boardEvents';
import { useBoardViewport } from './useBoardViewport';
import { useBoardSelection } from './useBoardSelection';
import { useBoardImportExport } from './useBoardImportExport';

export function useBoardEditor(id: string | undefined) {
  const {
    state,
    clipboard,
    resetBoard,
    dispatchEvent,
    undo,
    redo,
    setViewport,
    applyTransientObjectPatch,
    copySelectionToClipboard,
    pasteFromClipboard,
    clearClipboard,
  } = useWhiteboard();
  const boardTypeDef = getBoardType(state?.meta.boardType ?? 'advanced');
  const toolbox = boardTypeDef.toolbox;
  const toolboxKey = useMemo(() => toolbox.map((t) => t.id).join('|'), [toolbox]);

  const toolInstanceById = useMemo(() => {
    const map: Record<string, (typeof toolbox)[number]> = {};
    toolbox.forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }, [toolboxKey]);

  const defaultToolInstanceId = useMemo(() => {
    const firstNonSelect = toolbox.find((t) => t.baseToolId !== 'select');
    return (firstNonSelect ?? toolbox[0] ?? { id: 'select' }).id;
  }, [toolboxKey]);

  const [activeToolInstanceId, setActiveToolInstanceId] = useState<string>(() => defaultToolInstanceId);

  // Stroke settings are tracked per tool instance (enables presets like filled/outline later).
  const [strokeByToolInstance, setStrokeByToolInstance] = useState<
    Record<string, { strokeColor: string; strokeWidth: number }>
  >({});

  // Per-tool-instance settings beyond strokeColor/strokeWidth.
  // These drive both tool UI and defaults applied when creating new objects.
  const [toolPropsByToolInstance, setToolPropsByToolInstance] = useState<Record<string, Partial<WhiteboardObject>>>({});

  // Ensure presets/tool-instance defaults are available even before the user touches settings.
  // We intentionally only seed missing entries (never overwrite user-changed values).
  useEffect(() => {
    setToolPropsByToolInstance((prev) => {
      let next = prev;
      for (const ti of toolbox) {
        if (!ti.defaults) continue;
        if (prev[ti.id] !== undefined) continue;
        if (next === prev) next = { ...prev };
        next[ti.id] = { ...(ti.defaults as any) };
      }
      return next;
    });
  }, [toolboxKey]);

  // Ensure the active tool instance is valid for the current board type.
  useEffect(() => {
    if (!toolInstanceById[activeToolInstanceId]) {
      setActiveToolInstanceId(defaultToolInstanceId);
    }
  }, [toolInstanceById, activeToolInstanceId, defaultToolInstanceId, toolboxKey]);

  const activeTool: DrawingTool =
    (toolInstanceById[activeToolInstanceId]?.baseToolId ?? 'select') as DrawingTool;

  // ---- Board type policy: locked tool props ----
  const lockedForActiveTool = useMemo(() => {
    // DrawingTool is a superset; boardTypes helpers accept ToolId.
    return getLockedToolProps(boardTypeDef, activeTool as any);
  }, [boardTypeDef, activeTool]);
  const lockedEditableKeys = useMemo(() => getLockedEditableKeys(lockedForActiveTool), [lockedForActiveTool]);

  const rawStrokeColor = strokeByToolInstance[activeToolInstanceId]?.strokeColor ?? '#38bdf8';
  const rawStrokeWidth = strokeByToolInstance[activeToolInstanceId]?.strokeWidth ?? 3;

  const strokeColor =
    isEditablePropLocked(lockedForActiveTool, 'strokeColor') && typeof lockedForActiveTool.strokeColor === 'string'
      ? lockedForActiveTool.strokeColor
      : rawStrokeColor;
  const strokeWidth =
    isEditablePropLocked(lockedForActiveTool, 'strokeWidth') && typeof lockedForActiveTool.strokeWidth === 'number'
      ? lockedForActiveTool.strokeWidth
      : rawStrokeWidth;

  const setStrokeColor = (color: string) => {
    if (lockedEditableKeys.has('strokeColor')) return;
    setStrokeByToolInstance((prev) => {
      const current = prev[activeToolInstanceId] ?? { strokeColor: '#38bdf8', strokeWidth: 3 };
      return { ...prev, [activeToolInstanceId]: { ...current, strokeColor: color } };
    });
  };

  const setStrokeWidth = (value: number) => {
    if (lockedEditableKeys.has('strokeWidth')) return;
    setStrokeByToolInstance((prev) => {
      const current = prev[activeToolInstanceId] ?? { strokeColor: '#38bdf8', strokeWidth: 3 };
      return { ...prev, [activeToolInstanceId]: { ...current, strokeWidth: value } };
    });
  };

  const updateActiveToolProp = <K extends keyof WhiteboardObject>(
    key: K,
    value: WhiteboardObject[K]
  ) => {
    if (lockedEditableKeys.has(key as any)) return;
    setToolPropsByToolInstance((prev) => {
      const seededDefaults = (toolInstanceById[activeToolInstanceId]?.defaults ?? {}) as Partial<WhiteboardObject>;
      const current = prev[activeToolInstanceId] ?? seededDefaults;
      return {
        ...prev,
        [activeToolInstanceId]: {
          ...current,
          [key]: value,
        },
      };
    });
  };
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
          boardType: indexMeta?.boardType ?? 'advanced',
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
            boardType: indexMeta?.boardType ?? 'advanced',
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
              boardType: 'advanced',
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

  const handleTransientObjectPatch = (objectId: string, patch: Partial<WhiteboardObject>) => {
    // Apply live interaction patches without creating undo/redo history.
    applyTransientObjectPatch(objectId as any, patch);
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

  const updateStrokeWidth = (value: number) => {
    if (!Number.isNaN(value) && value > 0 && value <= 20) {
      setStrokeWidth(value);
    }
  };

  // ---- Sub-hooks ----

  const dpr =
  typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

  const logicalCanvasWidth = canvasEl ? canvasEl.width / dpr : undefined;
  const logicalCanvasHeight = canvasEl ? canvasEl.height / dpr : undefined;

  // ---- Clipboard actions (copy/paste) ----
  const handleCopySelectionToClipboard = () => {
    copySelectionToClipboard();
  };

  const handlePasteFromClipboard = () => {
    pasteFromClipboard({
      canvasWidth: logicalCanvasWidth,
      canvasHeight: logicalCanvasHeight,
    });
  };

  const handleClearClipboard = () => {
    clearClipboard();
  };

  const {
    zoomPercent,
    handleViewportChange,
    handleZoomChange,
    handleFitView
  } = useBoardViewport({
    viewport: state?.viewport,
    setViewport,
    applyTransientObjectPatch,
    objects: state?.objects,
    canvasWidth: logicalCanvasWidth,
    canvasHeight: logicalCanvasHeight
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

  // ---- Board type changes ----
  const setBoardType = async (nextType: WhiteboardMeta['boardType']) => {
    if (!state) return;
    if (state.meta.boardType === nextType) return;

    const now = new Date().toISOString();
    const nextBoardTypeDef = getBoardType(nextType);

    // Apply locked object props immediately so the board becomes consistent with the new type.
    const nextObjects = state.objects.map((o) => {
      const locked = getLockedObjectProps(nextBoardTypeDef, o.type);
      if (!locked || Object.keys(locked).length === 0) return o;
      return { ...o, ...locked };
    });

    // Update the boards index so the list page shows the new type.
    try {
      const boardsRepo = getBoardsRepository();
      await boardsRepo.setBoardType(state.meta.id, nextType);
    } catch (err) {
      console.error('Failed to persist boardType to boards index', err);
    }

    // Update in-memory state + persisted board state.
    resetBoard({
      ...state,
      meta: {
        ...state.meta,
        boardType: nextType,
        updatedAt: now,
      },
      objects: nextObjects,
    });
  };

  return {
    state,
    clipboard,
    boardTypeDef,
    activeTool,
    toolbox,
    setBoardType,
    activeToolInstanceId,
    setActiveToolInstanceId,
    strokeColor,
    setStrokeColor,
    strokeWidth,
    setStrokeWidth,
    toolProps: {
      ...((toolInstanceById[activeToolInstanceId]?.defaults ?? {}) as any),
      ...(toolPropsByToolInstance[activeToolInstanceId] ?? {}),
      ...lockedForActiveTool,
    },
    updateActiveToolProp,
    canvasEl,
    setCanvasEl,
    fileInputRef,
    handleCreateObject,
    handleSelectionChange,
    handleUpdateObject,
    handleTransientObjectPatch,
    handleDeleteSelection,
    handleStrokeWidthChange,
    updateStrokeWidth,
    handleViewportChange,
    zoomPercent,
    handleZoomChange,
    handleFitView,
    handleExportJson,
    handleExportPng,
    handleImportClick,
    handleImportFileChange,
    selectedObjects,
    updateSelectionProp,
    canUndo,
    canRedo,
    undo,
    redo,

    // Copy/paste actions (wired to clipboard storage; UI comes in the next step)
    hasClipboard: !!clipboard,
    copySelectionToClipboard: handleCopySelectionToClipboard,
    pasteFromClipboard: handlePasteFromClipboard,
    clearClipboard: handleClearClipboard,
  };
}