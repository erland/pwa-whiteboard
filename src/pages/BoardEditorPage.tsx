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
import { useBoardVoting } from './hooks/useBoardVoting';
import { useSharedTimer } from './hooks/useSharedTimer';
import { useBoardReactions } from './hooks/useBoardReactions';
import { usePresenterFollow } from './hooks/usePresenterFollow';
import { createBoardAccessContext, type PublicationSession } from './hooks/publicationSession';
import { createPublicationsApi, type BoardPublication } from '../api/publicationsApi';

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


function getInitialPublicationToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get('publication');
    return q ? q.trim() : null;
  } catch {
    return null;
  }
}

function mapPublicationSession(token: string, publication: BoardPublication): PublicationSession {
  return {
    token,
    id: publication.id,
    boardId: publication.boardId,
    targetType: publication.targetType,
    snapshotVersion: publication.snapshotVersion ?? null,
    allowComments: publication.allowComments,
    state: publication.state,
    createdAt: publication.createdAt,
    updatedAt: publication.updatedAt,
    expiresAt: publication.expiresAt ?? null,
  };
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
  const initialPublicationToken = useMemo(() => getInitialPublicationToken(), []);
  const [inviteToken, setInviteToken] = useState<string | null>(initialInviteToken);
  const [allowGuestInvite, setAllowGuestInvite] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<{ permission?: InvitePermission; expiresAt?: string } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [inviteAccepted, setInviteAccepted] = useState(false);
  const [guestInviteValidated, setGuestInviteValidated] = useState(false);
  const [persistedInviteAccess, setPersistedInviteAccess] = useState<PersistedInviteAccess | null>(null);
  const [isInviteLookupPending, setIsInviteLookupPending] = useState(
    Boolean(boardId) && serverConfigured && oidcConfigured && !auth.authenticated && !initialInviteToken && !initialPublicationToken
  );
  const [publicationSession, setPublicationSession] = useState<PublicationSession | null>(null);
  const [publicationError, setPublicationError] = useState<string | null>(null);
  const [isPublicationLookupPending, setIsPublicationLookupPending] = useState(Boolean(initialPublicationToken) && serverConfigured);

  const isInviteFlow = !!inviteToken && serverConfigured && oidcConfigured && !initialPublicationToken;
  const shouldProcessInvite = isInviteFlow && (auth.authenticated || allowGuestInvite);

  useEffect(() => {
    if (!boardId || !serverConfigured || !oidcConfigured || auth.authenticated || initialInviteToken || initialPublicationToken) {
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
  }, [auth.authenticated, boardId, initialInviteToken, initialPublicationToken, oidcConfigured, serverConfigured]);

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

  useEffect(() => {
    if (!initialPublicationToken || !serverConfigured) {
      setIsPublicationLookupPending(false);
      return;
    }

    let cancelled = false;
    setIsPublicationLookupPending(true);
    setPublicationError(null);

    createPublicationsApi()
      .resolve(initialPublicationToken)
      .then((publication) => {
        if (cancelled) return;
        const session = mapPublicationSession(initialPublicationToken, publication);
        setPublicationSession(session);
        if (boardId && boardId !== session.boardId) {
          navigate(`/board/${encodeURIComponent(session.boardId)}?publication=${encodeURIComponent(initialPublicationToken)}`, { replace: true });
        }
      })
      .catch((e: any) => {
        if (cancelled) return;
        setPublicationError(e?.message ? String(e.message) : 'Failed to resolve publication link.');
      })
      .finally(() => {
        if (!cancelled) setIsPublicationLookupPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [boardId, initialPublicationToken, navigate, serverConfigured]);
  const startSignIn = React.useCallback(() => {
    try {
      sessionStorage.setItem('pwa-whiteboard.postLoginRedirect', window.location.href);
    } catch {
      // ignore
    }
    auth.login();
  }, [auth]);

  const handleRetryInviteAccept = () => {
    setInviteError(null);
    setAcceptingInvite(false);
    setGuestInviteValidated(false);
    setInviteAccepted(false);
    setPersistedInviteAccess(null);
    setInviteToken((t) => (t ? `${t}` : t));
  };

  if (isPublicationLookupPending || isInviteLookupPending) {
    return <p>Loading board access…</p>;
  }

  if (publicationError) {
    return <p>Publication error: {publicationError}</p>;
  }

  if (isInviteFlow && !auth.authenticated && !allowGuestInvite) {
    return (
      <InviteChoiceGate
        onSignIn={startSignIn}
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
      boardId={publicationSession?.boardId ?? boardId}
      inviteToken={allowGuestInvite ? inviteToken : null}
      publicationSession={publicationSession}
      persistedInviteAccess={persistedInviteAccess}
      serverConfigured={serverConfigured}
      oidcConfigured={oidcConfigured}
      acceptingInvite={acceptingInvite}
      inviteError={inviteError}
      inviteAccepted={inviteAccepted}
      onStartSignIn={startSignIn}
    />
  );
};

const BoardEditorContent: React.FC<{
  boardId: string;
  inviteToken: string | null;
  publicationSession: PublicationSession | null;
  persistedInviteAccess: PersistedInviteAccess | null;
  serverConfigured: boolean;
  oidcConfigured: boolean;
  acceptingInvite: boolean;
  inviteError: string | null;
  inviteAccepted: boolean;
  onStartSignIn: () => void;
}> = ({
  boardId,
  inviteToken,
  publicationSession,
  persistedInviteAccess,
  serverConfigured,
  oidcConfigured,
  acceptingInvite,
  inviteError,
  inviteAccepted,
  onStartSignIn,
}) => {
  const auth = useAuth();

  const access = useMemo(
    () => createBoardAccessContext({ inviteToken, publicationSession }),
    [inviteToken, publicationSession]
  );

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
    applyViewport,
  } = useBoardEditor(boardId, { accessMode: access.mode });

  const boardName = state?.meta?.name ?? (access.isPublicationAccess ? 'Published board' : 'Untitled board');
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isFacilitationOpen, setIsFacilitationOpen] = useState(false);
  const [facilitationTab, setFacilitationTab] = useState<'overview' | 'comments' | 'voting' | 'timer'>('overview');
  const [commentsFocusedObjectId, setCommentsFocusedObjectId] = useState<string | null>(null);
  const capabilities = useBoardCapabilities({
    enabled: Boolean(boardId) && serverConfigured,
  });
  const comments = useBoardComments({
    boardId,
    enabled: Boolean(boardId) && serverConfigured && capabilities.features.supportsComments,
    authenticated: auth.authenticated,
    selectedObjectIds: state?.selectedObjectIds ?? [],
    access,
  });
  const sharedTimer = useSharedTimer({
    enabled: Boolean(boardId) && serverConfigured && capabilities.features.supportsSharedTimer,
    connected: collab.enabled && collab.status === 'connected',
    canControl: collab.enabled && collab.status === 'connected' && (collab.role === 'owner' || collab.role === 'editor'),
    lastEphemeralMessage: collab.lastEphemeralMessage,
    sendEphemeral: collab.sendEphemeral,
  });

  const reactions = useBoardReactions({
    enabled: Boolean(boardId) && serverConfigured && capabilities.features.supportsReactions,
    canReact: collab.enabled && collab.status === 'connected',
    selfUserId: collab.selfUserId,
    lastEphemeralMessage: collab.lastEphemeralMessage,
    sendEphemeral: collab.sendEphemeral,
  });


  const presenterFollow = usePresenterFollow({
    enabled: collab.enabled && collab.status === 'connected',
    selfUserId: collab.selfUserId,
    users: collab.users,
    presenceByUserId: collab.presenceByUserId,
    lastEphemeralMessage: collab.lastEphemeralMessage,
    sendEphemeral: collab.sendEphemeral,
    applyViewport,
  });

  const handleViewportChangeWithFollow = React.useCallback((patch: any) => {
    if (presenterFollow.followingUserId) presenterFollow.stopFollowing();
    handleViewportChange(patch);
  }, [handleViewportChange, presenterFollow]);


  const handleZoomChangeWithFollow: typeof handleZoomChange = React.useCallback((event) => {
    if (presenterFollow.followingUserId) presenterFollow.stopFollowing();
    handleZoomChange(event);
  }, [handleZoomChange, presenterFollow]);

  const handleFitViewWithFollow = React.useCallback(() => {
    if (presenterFollow.followingUserId) presenterFollow.stopFollowing();
    handleFitView();
  }, [handleFitView, presenterFollow]);

  const voting = useBoardVoting({
    boardId,
    enabled: Boolean(boardId) && serverConfigured && capabilities.features.supportsVoting,
    authenticated: auth.authenticated,
    selectedObjectIds: state?.selectedObjectIds ?? [],
    objects: state?.objects ?? [],
    access,
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


  const filteredComments = useMemo(() => {
    if (!commentsFocusedObjectId) return comments.comments;
    const byId = new Map(comments.comments.map((comment) => [comment.id, comment]));
    const belongsToFocusedObject = (comment: (typeof comments.comments)[number]) => {
      let current = comment;
      const seen = new Set<string>();
      while (current.parentCommentId && !seen.has(current.parentCommentId)) {
        seen.add(current.parentCommentId);
        const parent = byId.get(current.parentCommentId);
        if (!parent) break;
        current = parent;
      }
      return current.targetType === 'object' && current.targetRef === commentsFocusedObjectId;
    };
    return comments.comments.filter(belongsToFocusedObject);
  }, [comments.comments, commentsFocusedObjectId]);


  const filteredCommentsActiveCount = useMemo(
    () => filteredComments.filter((comment) => comment.state === 'active').length,
    [filteredComments]
  );
  const filteredCommentsResolvedCount = useMemo(
    () => filteredComments.filter((comment) => comment.state === 'resolved').length,
    [filteredComments]
  );

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
      accessMode={access.mode}
      publicationSession={publicationSession}
      serverConfigured={serverConfigured}
      oidcConfigured={oidcConfigured}
      acceptingInvite={acceptingInvite}
      inviteError={inviteError}
      inviteAccepted={inviteAccepted}
      isShareOpen={isShareOpen}
      onOpenShare={() => setIsShareOpen(true)}
      onCloseShare={() => setIsShareOpen(false)}
      onPublicationSignIn={onStartSignIn}
      isFacilitationOpen={isFacilitationOpen}
      facilitationTab={facilitationTab}
      onOpenComments={() => { setCommentsFocusedObjectId(null); setFacilitationTab('comments'); setIsFacilitationOpen(true); }}
      onOpenVoting={() => { setFacilitationTab('voting'); setIsFacilitationOpen(true); }}
      onOpenSharedTimer={() => { setFacilitationTab('timer'); setIsFacilitationOpen(true); }}
      onOpenFacilitation={() => { setCommentsFocusedObjectId(null); setFacilitationTab('overview'); setIsFacilitationOpen(true); }}
      onChangeFacilitationTab={setFacilitationTab}
      onCloseFacilitation={() => setIsFacilitationOpen(false)}
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
      handleViewportChange={handleViewportChangeWithFollow}
      zoomPercent={zoomPercent}
      handleZoomChange={handleZoomChangeWithFollow}
      handleFitView={handleFitViewWithFollow}
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

      presenterUserId={presenterFollow.presenterUserId}
      presenterDisplayName={presenterFollow.presenter?.displayName ?? null}
      followingUserId={presenterFollow.followingUserId}
      isFollowingPresenter={presenterFollow.isFollowingPresenter}
      startPresenting={presenterFollow.startPresenting}
      stopPresenting={presenterFollow.stopPresenting}
      followUser={presenterFollow.followUser}
      stopFollowing={presenterFollow.stopFollowing}
      isReadOnly={isReadOnly}
      handleCursorWorldMove={handleCursorWorldMove}
      features={capabilities.features}
      isCapabilitiesLoading={capabilities.isLoading}
      capabilitiesError={capabilities.error}
      commentsEnabled={capabilities.features.supportsComments}
      commentsAuthenticated={auth.authenticated}
      commentsCanCreate={comments.canCreate}
      commentsCanManage={comments.canManage}
      commentsViewOnlyMessage={comments.viewOnlyMessage}
      commentsTargetLabel={comments.target.label}
      comments={filteredComments}
      commentObjectAnchors={comments.objectAnchors}
      commentsFocusedObjectId={commentsFocusedObjectId}
      clearCommentsObjectFocus={() => setCommentsFocusedObjectId(null)}
      commentsLoading={comments.isLoading}
      commentsMutating={comments.isMutating}
      commentsError={comments.error}
      commentsActiveCount={filteredCommentsActiveCount}
      commentsResolvedCount={filteredCommentsResolvedCount}
      refreshComments={comments.refresh}
      createComment={comments.createComment}
      replyToComment={comments.replyToComment}
      resolveComment={comments.resolveComment}
      reopenComment={comments.reopenComment}
      deleteComment={comments.deleteComment}
      openObjectComments={(objectId) => { setCommentsFocusedObjectId(objectId); setFacilitationTab('comments'); setIsFacilitationOpen(true); }}
      votingEnabled={capabilities.features.supportsVoting}
      votingAuthenticated={auth.authenticated}
      votingSessions={voting.sessions}
      votingSelectedSessionId={voting.selectedSessionId}
      votingResults={voting.results}
      votingAvailableTargets={voting.availableTargets}
      votingSelectedTargets={voting.selectedTargets}
      votingLocalVotesByTarget={voting.localVotesByTarget}
      votingRemainingVotes={voting.remainingVotes}
      votingCanManage={voting.canManage}
      votingCanVote={voting.canVote}
      votingCanRemoveVotes={voting.canRemoveVotes}
      votingParticipantMode={voting.participantMode}
      votingParticipantToken={voting.participantToken}
      votingCanUsePublicationParticipation={voting.canUsePublicationParticipation}
      resetVotingParticipantToken={voting.resetParticipantToken}
      votingLoading={voting.isLoading}
      votingMutating={voting.isMutating}
      votingError={voting.error}
      refreshVoting={voting.refresh}
      selectVotingSession={voting.selectSession}
      createVotingSession={voting.createSession}
      openVotingSession={voting.openSession}
      closeVotingSession={voting.closeSession}
      revealVotingSession={voting.revealSession}
      cancelVotingSession={voting.cancelSession}
      castVote={voting.castVote}
      removeVote={voting.removeVote}
      sharedTimerEnabled={capabilities.features.supportsSharedTimer}
      reactionsEnabled={capabilities.features.supportsReactions}
      reactionOptions={reactions.quickReactions}
      onSendReaction={reactions.sendReaction}
      reactionBursts={reactions.bursts}
      sharedTimerConnected={sharedTimer.isConnected}
      sharedTimerCanControl={sharedTimer.canControl}
      sharedTimer={sharedTimer.timer}
      sharedTimerLabel={sharedTimer.timer?.label ?? null}
      sharedTimerDisplay={sharedTimer.formattedRemaining}
      sharedTimerState={sharedTimer.timer?.state ?? null}
      sharedTimerActive={Boolean(sharedTimer.timer)}
      sharedTimerRemainingMs={sharedTimer.displayRemainingMs}
      sharedTimerMutating={sharedTimer.isMutating}
      sharedTimerError={sharedTimer.error}
      clearSharedTimerError={sharedTimer.clearError}
      startSharedTimer={sharedTimer.startTimer}
      pauseSharedTimer={sharedTimer.pauseTimer}
      resumeSharedTimer={sharedTimer.resumeTimer}
      resetSharedTimer={sharedTimer.resetTimer}
      cancelSharedTimer={sharedTimer.cancelTimer}
      completeSharedTimer={sharedTimer.completeTimer}
    />
  );
};
