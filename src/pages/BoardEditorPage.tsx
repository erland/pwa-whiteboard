import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { isWhiteboardServerConfigured, isOidcConfigured } from '../config/server';
import { acceptInvite, validateInvite } from '../api/invitesApi';

import { BoardEditorShell } from './boardEditor/BoardEditorShell';
import { InviteAcceptanceGate } from './boardEditor/gates/InviteAcceptanceGate';
import { InviteChoiceGate } from './boardEditor/gates/InviteChoiceGate';
import { useBoardEditorShortcuts } from './boardEditor/hooks/useBoardEditorShortcuts';
import { useBoardEditor } from './hooks/useBoardEditor';

function getInitialInviteToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get('invite');
    return q ? q.trim() : null;
  } catch {
    return null;
  }
}

export const BoardEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const boardId = id ?? '';

  const navigate = useNavigate();
  const auth = useAuth();

  const serverConfigured = isWhiteboardServerConfigured();
  const oidcConfigured = isOidcConfigured();

  const initialInviteToken = useMemo(() => getInitialInviteToken(), []);
  const [inviteToken, setInviteToken] = useState<string | null>(initialInviteToken);
  const [allowGuestInvite, setAllowGuestInvite] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<{ permission?: string; expiresAt?: string } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [inviteAccepted, setInviteAccepted] = useState(false);

  const isInviteFlow = !!inviteToken && serverConfigured && oidcConfigured;

  useEffect(() => {
    if (!isInviteFlow || !inviteToken || !auth.authenticated) return;

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

  const handleInviteSignIn = () => {
    try {
      sessionStorage.setItem('pwa-whiteboard.postLoginRedirect', window.location.href);
    } catch {
      // ignore
    }
    auth.login();
  };

  const handleRetryInviteAccept = () => {
    setInviteError(null);
    setAcceptingInvite(false);
    setInviteToken((t) => (t ? t : t));
  };

  if (isInviteFlow && !auth.authenticated && !allowGuestInvite) {
    return (
      <InviteChoiceGate
        onSignIn={handleInviteSignIn}
        onContinueAsGuest={() => setAllowGuestInvite(true)}
        onCancel={() => navigate('/')}
      />
    );
  }

  if (isInviteFlow && auth.authenticated && !allowGuestInvite && !inviteAccepted) {
    return (
      <InviteAcceptanceGate
        acceptingInvite={acceptingInvite}
        inviteError={inviteError}
        onRetry={handleRetryInviteAccept}
        onBack={() => navigate('/')}
      />
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
}> = ({
  boardId,
  inviteToken,
  serverConfigured,
  oidcConfigured,
  acceptingInvite,
  inviteError,
  inviteAccepted,
}) => {
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
    hasClipboard,
    copySelectionToClipboard,
    pasteFromClipboard,
    collab,
    isReadOnly,
    handleCursorWorldMove,
  } = useBoardEditor(boardId);

  const boardName = state?.meta?.name ?? 'Untitled board';
  const [isShareOpen, setIsShareOpen] = useState(false);

  const canCopy = (state?.selectedObjectIds?.length ?? 0) > 0;
  const canPaste = !!hasClipboard;

  useBoardEditorShortcuts({
    isReadOnly,
    canCopy,
    canPaste,
    onDeleteSelection: handleDeleteSelection,
    onCopy: copySelectionToClipboard,
    onPaste: pasteFromClipboard,
  });

  return (
    <BoardEditorShell
      boardId={boardId}
      boardName={boardName}
      inviteToken={inviteToken}
      serverConfigured={serverConfigured}
      oidcConfigured={oidcConfigured}
      acceptingInvite={acceptingInvite}
      inviteError={inviteError}
      inviteAccepted={inviteAccepted}
      isShareOpen={isShareOpen}
      onOpenShare={() => setIsShareOpen(true)}
      onCloseShare={() => setIsShareOpen(false)}
      state={state}
      boardTypeDef={boardTypeDef}
      activeTool={activeTool}
      toolbox={toolbox}
      setBoardType={setBoardType}
      activeToolInstanceId={activeToolInstanceId}
      setActiveToolInstanceId={setActiveToolInstanceId}
      strokeColor={strokeColor}
      setStrokeColor={setStrokeColor}
      strokeWidth={strokeWidth}
      updateStrokeWidth={updateStrokeWidth}
      toolProps={toolProps as Record<string, unknown>}
      updateActiveToolProp={updateActiveToolProp as (key: string, value: unknown) => void}
      canvasEl={canvasEl}
      setCanvasEl={setCanvasEl}
      fileInputRef={fileInputRef}
      handleCreateObject={handleCreateObject}
      handleSelectionChange={handleSelectionChange}
      handleUpdateObject={handleUpdateObject}
      handleTransientObjectPatch={handleTransientObjectPatch}
      handleDeleteSelection={handleDeleteSelection}
      handleViewportChange={handleViewportChange}
      zoomPercent={zoomPercent}
      handleZoomChange={handleZoomChange}
      handleFitView={handleFitView}
      handleExportJson={handleExportJson}
      handleExportPng={handleExportPng}
      handleImportClick={handleImportClick}
      handleImportFileChange={handleImportFileChange}
      selectedObjects={selectedObjects}
      updateSelectionProp={updateSelectionProp as <K extends string>(key: K, value: unknown) => void}
      canUndo={canUndo}
      canRedo={canRedo}
      undo={undo}
      redo={redo}
      canCopy={canCopy}
      canPaste={canPaste}
      copySelectionToClipboard={copySelectionToClipboard}
      pasteFromClipboard={pasteFromClipboard}
      collab={collab}
      isReadOnly={isReadOnly}
      handleCursorWorldMove={handleCursorWorldMove}
    />
  );
};
