import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { WhiteboardCanvas } from '../whiteboard/WhiteboardCanvas';

import { BoardEditorHeader } from './boardEditor/BoardEditorHeader';
import { HistoryAndViewPanel } from './boardEditor/HistoryAndViewPanel';
import { ExportImportPanel } from './boardEditor/ExportImportPanel';
import { ToolSelectorPanel } from './boardEditor/ToolSelectorPanel';
import { ToolAndSelectionPanel } from './boardEditor/ToolAndSelectionPanel';
import { BoardInfoPanel } from './boardEditor/BoardInfoPanel';
import { useBoardEditor } from './hooks/useBoardEditor';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

export const BoardEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const {
    state,
    boardTypeDef,
    activeTool,
    toolbox,
    setBoardType,
    activeToolInstanceId,
    setActiveToolInstanceId,
    strokeColor,
    setStrokeColor,
    strokeWidth,
    updateStrokeWidth,
    toolProps,
    updateActiveToolProp,
    canvasEl,
    setCanvasEl,
    fileInputRef,
    handleCreateObject,
    handleSelectionChange,
    handleUpdateObject,
    handleDeleteSelection,
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

    // Copy/paste actions
    hasClipboard,
    copySelectionToClipboard,
    pasteFromClipboard,
  } = useBoardEditor(id);

  // Derive board name from state (adjust if your meta shape differs)
  const boardName = state?.meta?.name ?? 'Untitled board';

  const canCopy = (state?.selectedObjectIds?.length ?? 0) > 0;
  const canPaste = !!hasClipboard;

  const shouldIgnoreShortcut = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    if ((el as any).isContentEditable) return true;
    const tag = el.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select';
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Only handle Ctrl/Cmd shortcuts.
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;
      if (shouldIgnoreShortcut(e.target)) return;

      const key = e.key.toLowerCase();
      if (key === 'c') {
        if (!canCopy) return;
        e.preventDefault();
        copySelectionToClipboard();
      }
      if (key === 'v') {
        if (!canPaste) return;
        e.preventDefault();
        pasteFromClipboard();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canCopy, canPaste, copySelectionToClipboard, pasteFromClipboard]);

  return (
    <section className="page page-board-editor">
      {/* Pass boardName instead of boardId */}
      <BoardEditorHeader
        boardName={boardName}
        canCopy={canCopy}
        canPaste={canPaste}
        onCopy={copySelectionToClipboard}
        onPaste={pasteFromClipboard}
      />

      <div className="board-editor-layout">
        <aside className="board-editor-sidebar">
          {/* Tools first */}
          <ToolSelectorPanel
            toolbox={toolbox}
            activeToolInstanceId={activeToolInstanceId}
            onChangeToolInstance={setActiveToolInstanceId}
          />

          {/* Then Tools & Selection */}
          <ToolAndSelectionPanel
            boardTypeDef={boardTypeDef}
            activeTool={activeTool}
            strokeColor={strokeColor}
            strokeWidth={strokeWidth}
            toolProps={toolProps}
            onStrokeColorChange={setStrokeColor}
            onStrokeWidthChange={updateStrokeWidth}
            onUpdateToolProp={updateActiveToolProp}
            selectedObjects={selectedObjects}
            onDeleteSelection={handleDeleteSelection}
            onCopySelection={copySelectionToClipboard}
            onPasteFromClipboard={pasteFromClipboard}
            canPaste={canPaste}
            updateSelectionProp={updateSelectionProp}
          />

          {/* Then Export & Import as dropdown */}
          <ExportImportPanel
            canExport={!!state}
            onExportJson={handleExportJson}
            onExportPng={handleExportPng}
            onImportClick={handleImportClick}
            fileInputRef={fileInputRef}
            onImportFileChange={handleImportFileChange}
          />

          {/* Board Info at the very bottom */}
          {state && (
            <BoardInfoPanel
              meta={state.meta}
              objectCount={state.objects.length}
              eventCount={state.history?.pastEvents.length ?? 0}
              onChangeBoardType={setBoardType}
            />
          )}
        </aside>

        <div className="board-editor-main">
          {/* History & View controls above the canvas */}
          <HistoryAndViewPanel
            canUndo={canUndo}
            canRedo={canRedo}
            zoomPercent={zoomPercent}
            onUndo={undo}
            onRedo={redo}
            onZoomChange={handleZoomChange}
            onFitView={handleFitView}
          />

          <div className="board-editor-canvas-wrapper">
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
                toolProps={toolProps}
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
      </div>
    </section>
  );
};