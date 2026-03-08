import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { isWhiteboardServerConfigured, isOidcConfigured } from '../config/server';
import { acceptInvite, validateInvite, type InvitePermission } from '../api/invitesApi';
import { getInvitedBoardsRepository } from '../infrastructure/localStorageInvitedBoardsRepository';

import { BoardEditorShell } from './boardEditor/BoardEditorShell';
import { InviteAcceptanceGate } from './boardEditor/gates/InviteAcceptanceGate';
import { InviteChoiceGate } from './boardEditor/gates/InviteChoiceGate';
import { useBoardEditorShortcuts } from './boardEditor/hooks/useBoardEditorShortcuts';
import { useBoardEditor } from './hooks/useBoardEditor';
import { useBoardCapabilities } from './hooks/useBoardCapabilities';
import { useBoardComments } from './hooks/useBoardComments';

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

type PersistedInviteAccess = {
  boardId: string;
  inviteToken: string;
  permission?: InvitePermission;
  expiresAt?: string;
};

async function persistInvitedBoardAccess(args: PersistedInviteAccess & { title?: string }): Promise<void> {
  await getInvitedBoardsRepository().saveInvitedBoard({
    boardId: args.boardId,
    title: args.title?.trim() || 'Invited board',
    inviteToken: args.inviteToken,
    permission: args.permission,
    expiresAt: args.expiresAt,
    lastOpenedAt: new Date().toISOString(),
  });
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
  const [inviteInfo, setInviteInfo] = useState<{ permission?: InvitePermission; expiresAt?: string } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [inviteAccepted, setInviteAccepted] = useState(false);
  const [guestInviteValidated, setGuestInviteValidated] = useState(false);
  const [persistedInviteAccess, setPersistedInviteAccess] = useState<PersistedInviteAccess | null>(null);
  const [isInviteLookupPending, setIsInviteLookupPending] = useState(
    Boolean(boardId) && serverConfigured && oidcConfigured && !auth.authenticated && !initialInviteToken
  );

  const isInviteFlow = !!inviteToken && serverConfigured && oidcConfigured;
  const shouldProcessInvite = isInviteFlow && (auth.authenticated || allowGuestInvite);

  useEffect(() => {
    if (!boardId || !serverConfigured || !oidcConfigured || auth.authenticated || initialInviteToken) {
      setIsInviteLookupPending(false);
      return;
    }

    let cancelled = false;
    setIsInviteLookupPending(true);

    getInvitedBoardsRepository()
      .getInvitedBoard(boardId)
      .then((record) => {
        if (cancelled) return;
        if (!record) {
          setIsInviteLookupPending(false);
          return;
        }

        setInviteToken(record.inviteToken);
        setInviteInfo({ permission: record.permission, expiresAt: record.expiresAt });
        setPersistedInviteAccess({
          boardId: record.boardId,
          inviteToken: record.inviteToken,
          permission: record.permission,
          expiresAt: record.expiresAt,
        });
        setAllowGuestInvite(true);

        try {
          const url = new URL(window.location.href);
          url.searchParams.set('invite', record.inviteToken);
          window.history.replaceState({}, '', url.toString());
        } catch {
          // ignore URL sync failures for stored invite access
        }

        setIsInviteLookupPending(false);
      })
      .catch(() => {
        if (!cancelled) setIsInviteLookupPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [auth.authenticated, boardId, initialInviteToken, oidcConfigured, serverConfigured]);

  useEffect(() => {
    if (!shouldProcessInvite || !inviteToken) return;

    let cancelled = false;
    setAcceptingInvite(true);
    setInviteError(null);

    (async () => {
      try {
        const validated = await validateInvite(inviteToken);
        if (cancelled) return;
        if (!validated?.valid) {
          throw new Error(validated?.reason ? String(validated.reason) : 'Invite is invalid.');
        }

        const access: PersistedInviteAccess = {
          boardId: validated.boardId || boardId,
          inviteToken,
          permission: validated.permission,
          expiresAt: validated.expiresAt,
        };

        setInviteInfo({ permission: validated.permission, expiresAt: validated.expiresAt });

        if (auth.authenticated) {
          await acceptInvite(inviteToken);
          if (cancelled) return;
          setInviteAccepted(true);
        } else {
          setGuestInviteValidated(true);
        }

        await persistInvitedBoardAccess(access);
        if (cancelled) return;
        setPersistedInviteAccess(access);

        if (auth.authenticated) {
          const url = new URL(window.location.href);
          url.searchParams.delete('invite');
          window.history.replaceState({}, '', url.toString());
          setInviteToken(null);
        }
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
  }, [shouldProcessInvite, inviteToken, auth.authenticated, boardId]);

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
    setGuestInviteValidated(false);
    setInviteAccepted(false);
    setPersistedInviteAccess(null);
    setInviteToken((t) => (t ? `${t}` : t));
  };

  if (isInviteLookupPending) {
    return <p>Loading board access…</p>;
  }

  if (isInviteFlow && !auth.authenticated && !allowGuestInvite) {
    return (
      <InviteChoiceGate
        onSignIn={handleInviteSignIn}
        onContinueAsGuest={() => setAllowGuestInvite(true)}
        onCancel={() => navigate('/')}
      />
    );
  }

  if (shouldProcessInvite && (!guestInviteValidated || (auth.authenticated && !inviteAccepted))) {
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
      persistedInviteAccess={persistedInviteAccess}
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
  persistedInviteAccess: PersistedInviteAccess | null;
  serverConfigured: boolean;
  oidcConfigured: boolean;
  acceptingInvite: boolean;
  inviteError: string | null;
  inviteAccepted: boolean;
}> = ({
  boardId,
  inviteToken,
  persistedInviteAccess,
  serverConfigured,
  oidcConfigured,
  acceptingInvite,
  inviteError,
  inviteAccepted,
}) => {
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
    hasClipboard,
    copySelectionToClipboard,
    pasteFromClipboard,
    collab,
    isReadOnly,
    handleCursorWorldMove,
  } = useBoardEditor(boardId);

  const boardName = state?.meta?.name ?? 'Untitled board';
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const capabilities = useBoardCapabilities({
    enabled: Boolean(boardId) && serverConfigured,
  });
  const comments = useBoardComments({
    boardId,
    enabled: Boolean(boardId) && serverConfigured && capabilities.features.supportsComments,
    authenticated: auth.authenticated,
    selectedObjectIds: state?.selectedObjectIds ?? [],
  });

  useEffect(() => {
    if (!persistedInviteAccess) return;

    persistInvitedBoardAccess({
      ...persistedInviteAccess,
      title: boardName,
    }).catch(() => {
      // ignore follow-up invite persistence failures
    });
  }, [persistedInviteAccess, boardName]);

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
      isCommentsOpen={isCommentsOpen}
      onOpenComments={() => setIsCommentsOpen(true)}
      onCloseComments={() => setIsCommentsOpen(false)}
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
      features={capabilities.features}
      isCapabilitiesLoading={capabilities.isLoading}
      capabilitiesError={capabilities.error}
      commentsEnabled={capabilities.features.supportsComments}
      commentsAuthenticated={auth.authenticated}
      commentsTargetLabel={comments.target.label}
      comments={comments.comments}
      commentsLoading={comments.isLoading}
      commentsMutating={comments.isMutating}
      commentsError={comments.error}
      commentsActiveCount={comments.activeCount}
      commentsResolvedCount={comments.resolvedCount}
      refreshComments={comments.refresh}
      createComment={comments.createComment}
      replyToComment={comments.replyToComment}
      resolveComment={comments.resolveComment}
      reopenComment={comments.reopenComment}
      deleteComment={comments.deleteComment}
    />
  );
};
