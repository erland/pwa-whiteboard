import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { WhiteboardCanvas } from '../whiteboard/WhiteboardCanvas';

import { useAuth } from '../auth/AuthContext';
import { isWhiteboardServerConfigured, isOidcConfigured } from '../config/server';
import { acceptInvite, validateInvite } from '../api/invitesApi';

import { BoardEditorHeader } from './boardEditor/BoardEditorHeader';
import { RemoteCursorsOverlay } from './boardEditor/RemoteCursorsOverlay';
import { HistoryAndViewPanel } from './boardEditor/HistoryAndViewPanel';
import { ExportImportPanel } from './boardEditor/ExportImportPanel';
import { ToolSelectorPanel } from './boardEditor/ToolSelectorPanel';
import { ToolAndSelectionPanel } from './boardEditor/ToolAndSelectionPanel';
import { BoardInfoPanel } from './boardEditor/BoardInfoPanel';
import { ShareDialog } from './boardEditor/ShareDialog';
import { useBoardEditor } from './hooks/useBoardEditor';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

export const BoardEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const boardId = id ?? '';

  const navigate = useNavigate();
  const auth = useAuth();

  const serverConfigured = isWhiteboardServerConfigured();
  const oidcConfigured = isOidcConfigured();

  const initialInviteToken = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const url = new URL(window.location.href);
      const q = url.searchParams.get('invite');
      return q ? q.trim() : null;
    } catch {
      return null;
    }
  }, []);

  const [inviteToken, setInviteToken] = useState<string | null>(initialInviteToken);

  // When opening an invite link unauthenticated, allow user to choose:
  //  - sign in (accept invite via REST)
  //  - continue as guest (use invite token for WS join)
  const [allowGuestInvite, setAllowGuestInvite] = useState(false);

  const [inviteInfo, setInviteInfo] = useState<{ permission?: string; expiresAt?: string } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [inviteAccepted, setInviteAccepted] = useState(false);

  const isInviteFlow = !!inviteToken && serverConfigured && oidcConfigured;

  // If authenticated and invite token exists, accept it via REST (so permissions are persisted server-side).
  useEffect(() => {
    if (!isInviteFlow) return;
    if (!inviteToken) return;
    if (!auth.authenticated) return;

    let cancelled = false;
    setAcceptingInvite(true);
    setInviteError(null);

    (async () => {
      try {
        const v = await validateInvite(inviteToken);
        if (cancelled) return;
        if (v?.valid) {
          setInviteInfo({ permission: v.permission, expiresAt: v.expiresAt });
        }
        await acceptInvite(inviteToken);
        if (cancelled) return;
        setInviteAccepted(true);

        // Remove invite token from URL after acceptance (avoids re-accept loops and leaking token).
        const url = new URL(window.location.href);
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', url.toString());
        setInviteToken(null);
      } catch (e: any) {
        if (cancelled) return;
        const msg = e?.message ? String(e.message) : 'Failed to accept invite.';
        setInviteError(msg);
      } finally {
        if (!cancelled) setAcceptingInvite(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isInviteFlow, inviteToken, auth.authenticated]);

  // Invite gate: show only when invite link is present, server+OIDC configured, and user is not authenticated,
  // unless they explicitly choose to continue as guest.
  if (isInviteFlow && !auth.authenticated && !allowGuestInvite) {
    return (
      <section className="page page-board-editor">
        <div style={{ maxWidth: 720, margin: '2rem auto', padding: '1rem' }}>
          <h2>Invite link</h2>
          <p>This board was shared with you. Choose how you want to open it:</p>
          <ul>
            <li><strong>Sign in</strong> to accept the invite and persist your access.</li>
            <li><strong>Open without signing in</strong> to join via the invite token (guest access).</li>
          </ul>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                try {
                  sessionStorage.setItem('pwa-whiteboard.postLoginRedirect', window.location.href);
                } catch {
                  // ignore
                }
                auth.login();
              }}
            >
              Sign in
            </button>
            <button type="button" onClick={() => setAllowGuestInvite(true)}>
              Open without signing in
            </button>
            <button type="button" onClick={() => navigate('/')}>
              Cancel
            </button>
          </div>
          <p style={{ marginTop: '1rem', opacity: 0.8 }}>
            Tip: If you just want local drawing without a server, open the app without an invite link.
          </p>
        </div>
      </section>
    );
  }



  // If we have an invite link and the user is authenticated, accept the invite *before* mounting the editor content.
  // This avoids a race where the editor tries to load snapshots / join WS before permissions are granted.
  if (isInviteFlow && auth.authenticated && !allowGuestInvite && !inviteAccepted) {
    return (
      <section className="page page-board-editor">
        <div style={{ maxWidth: 720, margin: '2rem auto', padding: '1rem' }}>
          <h2>Opening shared board…</h2>
          {acceptingInvite ? <p>Accepting invite…</p> : null}
          {inviteError ? (
            <>
              <p style={{ color: 'crimson' }}>{inviteError}</p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    // Retry by toggling state; effect depends on auth + inviteToken.
                    setInviteError(null);
                    setAcceptingInvite(false);
                    // Trigger effect by setting token (no-op but stable)
                    setInviteToken((t) => (t ? t : t));
                  }}
                >
                  Retry
                </button>
                <button type="button" onClick={() => navigate('/')}>Back</button>
              </div>
            </>
          ) : null}
        </div>
      </section>
    );
  }
  return (
    <BoardEditorContent
      boardId={boardId}
      inviteToken={allowGuestInvite ? inviteToken : null}
      serverConfigured={serverConfigured}
      oidcConfigured={oidcConfigured}
      acceptingInvite={acceptingInvite}
      inviteError={inviteError}
      inviteAccepted={inviteAccepted}
    />
  );
};

const BoardEditorContent: React.FC<{
  boardId: string;
  inviteToken: string | null;
  serverConfigured: boolean;
  oidcConfigured: boolean;
  acceptingInvite: boolean;
  inviteError: string | null;
  inviteAccepted: boolean;
}> = ({ boardId, inviteToken, serverConfigured, oidcConfigured, acceptingInvite, inviteError, inviteAccepted }) => {
  const navigate = useNavigate();
  const auth = useAuth();
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
    isReadOnly,
    handleCursorWorldMove,
} = useBoardEditor(boardId);

  // Derive board name from state (adjust if your meta shape differs)
  const boardName = state?.meta?.name ?? 'Untitled board';

  const inviteLink = React.useMemo(() => {
    if (!collab?.inviteToken) return undefined;
    const url = new URL(window.location.href);
    url.searchParams.set('invite', collab.inviteToken);
    url.hash = '';
    return url.toString();
  }, [collab?.inviteToken]);

  const [isShareOpen, setIsShareOpen] = useState(false);


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
        if (isReadOnly) return;
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
        if (isReadOnly) return;
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
      {inviteToken && serverConfigured && oidcConfigured && (
        <div className="collab-notice" role="status" aria-live="polite">
          {acceptingInvite && 'Accepting invite…'}
          {inviteError && `Invite error: ${inviteError}`}
          {inviteAccepted && !acceptingInvite && !inviteError && 'Invite accepted.'}
        </div>
      )}
      {/* Pass boardName instead of boardId */}
      <BoardEditorHeader
        onOpenShare={() => setIsShareOpen(true)}
        collab={{
          status: collab.enabled ? collab.status : 'disabled',
          role: collab.role,
          usersCount: collab.users?.length ?? 0,
          errorText: collab.errorText,
        }}
        boardName={boardName}
        isReadOnly={isReadOnly}
        canDelete={canCopy && !isReadOnly}
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
            isReadOnly={isReadOnly}
            activeToolInstanceId={activeToolInstanceId}
            onChangeToolInstance={setActiveToolInstanceId}
          />

          {/* Then Tools & Selection */}
          <ToolAndSelectionPanel
            isReadOnly={isReadOnly}
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

          {collab.enabled && collab.noticeText && (
            <div className="collab-notice" role="status" aria-live="polite">
              {collab.noticeText}
            </div>
          )}

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

              {collab.enabled && collab.status !== 'connected' && collab.status !== 'disabled' && (
                <div className="collab-overlay" aria-hidden="true">
                  <div className="collab-overlay-card">
                    <div className="collab-overlay-title">
                      {collab.isReconnecting || collab.hasEverConnected ? 'Reconnecting…' : 'Connecting…'}
                    </div>
                    <div className="collab-overlay-subtitle">
                      {collab.errorText ? collab.errorText : 'Trying to restore real-time collaboration…'}
                    </div>
                  </div>
                </div>
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
    
      <ShareDialog
        isOpen={isShareOpen}
        boardId={boardId}
        boardName={boardName}
        isReadOnly={isReadOnly}
        onCancel={() => setIsShareOpen(false)}
      />

</section>
  );
};
