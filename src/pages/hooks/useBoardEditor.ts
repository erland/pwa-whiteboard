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
import { useBoardCollaboration } from './useBoardCollaboration';
import type { PresencePayload } from '../../../shared/protocol';

export function useBoardEditor(id: string | undefined) {
  const {
    state,
    clipboard,
    resetBoard,
    dispatchEvent,
    applyRemoteEvent,
    undo,
    redo,
    setViewport,
    applyTransientObjectPatch,
    copySelectionToClipboard,
    pasteFromClipboard,
    clearClipboard,
  } = useWhiteboard();
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);

// ---- Collaboration (invite-based, realtime) ----
const collab = useBoardCollaboration({
  boardId: id,
  boardName: state?.meta?.name,
  resetBoard,
  applyRemoteEvent,
});

const canSendOps = collab.enabled && collab.status === 'connected' && (collab.role === 'owner' || collab.role === 'editor');

const dispatchOpEvent = (event: any) => {
  if (canSendOps) {
    collab.sendOp(event);
    return;
  }
  dispatchEvent(event);
};

const dispatchEventWithLocalOnly = (event: any) => {
  // Keep selection/viewport local-only (presence handles sharing).
  if (event?.type === 'selectionChanged' || event?.type === 'viewportChanged') {
    dispatchEvent(event);
    return;
  }
  dispatchOpEvent(event);
};

const sendPresence = (presence: PresencePayload) => {
  collab.sendPresence(presence);
};


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
    dispatchEvent: dispatchOpEvent,
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
    handleViewportChange: _handleViewportChange,
    handleZoomChange,
    handleFitView
  } = useBoardViewport({
    viewport: state?.viewport,
    setViewport,
    objects: state?.objects,
    canvasWidth: logicalCanvasWidth,
    canvasHeight: logicalCanvasHeight
  });

  const {
    selectedObjects,
    handleSelectionChange: _handleSelectionChange,
    handleDeleteSelection,
    updateSelectionProp
  } = useBoardSelection({
    state,
    dispatchEvent: dispatchEventWithLocalOnly,
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
    dispatchEvent: dispatchOpEvent,
    setViewport
  });

  const canUndo = !!state && state.history.pastEvents.length > 0;
  const canRedo = !!state && state.history.futureEvents.length > 0;
const handleSelectionChange = (selectedIds: string[]) => {
  _handleSelectionChange(selectedIds);
  // Broadcast as presence (not as ops)
  if (collab.enabled) {
    sendPresence({ selectionIds: selectedIds });
  }
};

const handleViewportChange = (patch: any) => {
  _handleViewportChange(patch);
  if (collab.enabled && state?.viewport) {
    const next = { ...state.viewport, ...patch };
    sendPresence({
      viewport: {
        panX: next.offsetX ?? 0,
        panY: next.offsetY ?? 0,
        zoom: next.zoom ?? 1,
      },
    });
  }
};

const handleCursorWorldMove = (pos: { x: number; y: number }) => {
  if (!collab.enabled) return;
  sendPresence({ cursor: { x: pos.x, y: pos.y } });
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
    handleViewportChange: _handleViewportChange,
    zoomPercent,
    handleZoomChange,
    handleFitView,
    handleExportJson,
    handleExportPng,
    handleImportClick,
    handleImportFileChange,
    selectedObjects,
    updateSelectionProp,
    collab,
    handleCursorWorldMove,
    canUndo,
    canRedo,
    undo,
    redo,

    // Copy/paste actions (wired to clipboard storage; UI comes in the next step)
    ...clipboardActions,
  };
}