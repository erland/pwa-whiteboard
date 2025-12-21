import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { WhiteboardCanvas } from '../whiteboard/WhiteboardCanvas';

import { BoardEditorHeader } from './boardEditor/BoardEditorHeader';
import { RemoteCursorsOverlay } from './boardEditor/RemoteCursorsOverlay';
import { HistoryAndViewPanel } from './boardEditor/HistoryAndViewPanel';
import { ExportImportPanel } from './boardEditor/ExportImportPanel';
import { ToolSelectorPanel } from './boardEditor/ToolSelectorPanel';
import { ToolAndSelectionPanel } from './boardEditor/ToolAndSelectionPanel';
import { BoardInfoPanel } from './boardEditor/BoardInfoPanel';
import { SharePanel } from './boardEditor/SharePanel';
import { useBoardEditor } from './hooks/useBoardEditor';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

export const BoardEditorPage: React.FC = () => {
  const {
id } = useParams<{ id: string }>();

  const boardId = id ?? '';

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
    handleTransientObjectPatch,
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

    collab,
    handleCursorWorldMove,
} = useBoardEditor(id);

  // Derive board name from state (adjust if your meta shape differs)
  const boardName = state?.meta?.name ?? 'Untitled board';

  const inviteLink = React.useMemo(() => {
    if (!collab?.inviteToken) return undefined;
    const url = new URL(window.location.href);
    url.searchParams.set('invite', collab.inviteToken);
    url.hash = '';
    return url.toString();
  }, [collab?.inviteToken]);

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
      if (shouldIgnoreShortcut(e.target)) return;

      const keyRaw = e.key;

      // Delete selection with Delete/Backspace (when not typing in an input).
      // Note: We intentionally keep this independent from Ctrl/Cmd.
      if (keyRaw === 'Backspace' || keyRaw === 'Delete') {
        if (!canCopy) return;
        e.preventDefault();
        handleDeleteSelection();
        return;
      }

      // Ctrl/Cmd shortcuts.
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      const key = keyRaw.toLowerCase();
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
  }, [canCopy, canPaste, copySelectionToClipboard, pasteFromClipboard, handleDeleteSelection]);

  return (
    <section className="page page-board-editor">
      {/* Pass boardName instead of boardId */}
      <BoardEditorHeader
        collab={{
          status: collab.enabled ? collab.status : 'disabled',
          role: collab.role,
          usersCount: collab.users?.length ?? 0,
          errorText: collab.errorText,
        }}
        inviteLink={inviteLink}
        boardName={boardName}
        canDelete={canCopy}
        canCopy={canCopy}
        canPaste={canPaste}
        onDelete={handleDeleteSelection}
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

          <SharePanel boardId={boardId} boardName={boardName} />


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
              <div className="board-editor-canvas-stack">
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
                onTransientObjectPatch={handleTransientObjectPatch}
                onViewportChange={handleViewportChange}
                onCanvasReady={setCanvasEl}
                onCursorWorldMove={handleCursorWorldMove}
              />
              {collab.enabled && collab.status === 'connected' && (
                <RemoteCursorsOverlay
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  viewport={state.viewport}
                  users={collab.users.filter((u) => u.userId !== collab.selfUserId)}
                  presenceByUserId={collab.presenceByUserId}
                />
              )}
              </div>
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