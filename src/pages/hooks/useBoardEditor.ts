// src/pages/hooks/useBoardEditor.ts
import { useState } from 'react';
import { useWhiteboard } from '../../whiteboard/WhiteboardStore';
import { useBoardViewport } from './useBoardViewport';
import { useBoardSelection } from './useBoardSelection';
import { useBoardImportExport } from './useBoardImportExport';
import { useBoardPersistence } from './useBoardPersistence';
import { useBoardPolicy } from './useBoardPolicy';
import { useBoardClipboard } from './useBoardClipboard';
import { useBoardMutations } from './useBoardMutations';

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
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);

  // ---- Persistence (load/init + board type changes) ----
  const { setBoardType } = useBoardPersistence({ id, state, resetBoard });

  // ---- Board type/tool policy (toolbox + locked props + settings) ----
  const {
    boardTypeDef,
    toolbox,
    activeTool,
    activeToolInstanceId,
    setActiveToolInstanceId,
    strokeColor,
    setStrokeColor,
    strokeWidth,
    setStrokeWidth,
    handleStrokeWidthChange,
    updateStrokeWidth,
    toolProps,
    updateActiveToolProp,
  } = useBoardPolicy({ boardType: state?.meta.boardType });

  // ---- Object events (create / update) ----
  const {
    handleCreateObject,
    handleUpdateObject,
    handleTransientObjectPatch,
  } = useBoardMutations({
    state,
    dispatchEvent,
    applyTransientObjectPatch,
  });

  // ---- Sub-hooks ----

  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

  const logicalCanvasWidth = canvasEl ? canvasEl.width / dpr : undefined;
  const logicalCanvasHeight = canvasEl ? canvasEl.height / dpr : undefined;

  // ---- Clipboard actions (copy/paste) ----
  const clipboardActions = useBoardClipboard({
    clipboard,
    copySelectionToClipboard,
    pasteFromClipboard,
    clearClipboard,
    canvasWidth: logicalCanvasWidth,
    canvasHeight: logicalCanvasHeight,
  });

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
    toolProps: toolProps as any,
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
    ...clipboardActions,
  };
}