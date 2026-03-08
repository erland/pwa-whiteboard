import React from 'react';
import { WhiteboardCanvas } from '../../whiteboard/WhiteboardCanvas';
import type { WhiteboardState } from '../../domain/types';
import type { BoardRole, PresencePayload, PresenceUser } from '../../../shared/protocol';
import type { CollabStatus } from '../../collab/CollabClient';
import { BoardEditorHeader } from './BoardEditorHeader';
import { ToolSelectorPanel } from './ToolSelectorPanel';
import { ToolAndSelectionPanel } from './ToolAndSelectionPanel';
import { ExportImportPanel } from './ExportImportPanel';
import { BoardInfoPanel } from './BoardInfoPanel';
import { HistoryAndViewPanel } from './HistoryAndViewPanel';
import { RemoteCursorsOverlay } from './RemoteCursorsOverlay';
import { ShareDialog } from './ShareDialog';
import { CommentsDialog } from './CommentsDialog';
import { VotingDialog } from './VotingDialog';
import { SharedTimerDialog } from './SharedTimerDialog';
import type { ServerFeatureFlags } from '../../domain/serverFeatures';
import type { BoardComment } from '../../api/commentsApi';
import type { VotingResults, VotingSession } from '../../api/votingApi';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

export type BoardEditorShellProps = {
  boardId: string;
  boardName: string;
  inviteToken: string | null;
  serverConfigured: boolean;
  oidcConfigured: boolean;
  acceptingInvite: boolean;
  inviteError: string | null;
  inviteAccepted: boolean;
  isShareOpen: boolean;
  onOpenShare: () => void;
  onCloseShare: () => void;
  isCommentsOpen: boolean;
  onOpenComments: () => void;
  onCloseComments: () => void;
  isVotingOpen: boolean;
  onOpenVoting: () => void;
  onCloseVoting: () => void;
  isSharedTimerOpen: boolean;
  onOpenSharedTimer: () => void;
  onCloseSharedTimer: () => void;
  state: WhiteboardState | null | undefined;
  boardTypeDef: any;
  activeTool: any;
  toolbox: any;
  setBoardType: (boardType: any) => void;
  activeToolInstanceId: string;
  setActiveToolInstanceId: (toolInstanceId: string) => void;
  strokeColor: string;
  setStrokeColor: (color: string) => void;
  strokeWidth: number;
  updateStrokeWidth: (width: number) => void;
  toolProps: Record<string, unknown>;
  updateActiveToolProp: (key: string, value: unknown) => void;
  canvasEl: HTMLCanvasElement | null;
  setCanvasEl: (canvas: HTMLCanvasElement | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleCreateObject: (object: any) => void;
  handleSelectionChange: (selectedIds: string[]) => void;
  handleUpdateObject: (id: string, patch: any) => void;
  handleTransientObjectPatch: (id: string, patch: any) => void;
  handleDeleteSelection: () => void;
  handleViewportChange: (patch: any) => void;
  zoomPercent: number;
  handleZoomChange: React.ChangeEventHandler<HTMLInputElement>;
  handleFitView: () => void;
  handleExportJson: () => void;
  handleExportPng: () => void;
  handleImportClick: () => void;
  handleImportFileChange: React.ChangeEventHandler<HTMLInputElement>;
  selectedObjects: any[];
  updateSelectionProp: <K extends string>(key: K, value: unknown) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  canCopy: boolean;
  canPaste: boolean;
  copySelectionToClipboard: () => void;
  pasteFromClipboard: () => void;
  collab: {
    enabled: boolean;
    status: CollabStatus | 'disabled';
    role?: BoardRole;
    users: PresenceUser[];
    presenceByUserId: Record<string, PresencePayload>;
    selfUserId: string;
    errorText?: string;
    noticeText?: string;
    isReconnecting: boolean;
    hasEverConnected: boolean;
  };
  isReadOnly: boolean;
  handleCursorWorldMove: (pos: { x: number; y: number }) => void;
  features: ServerFeatureFlags;
  isCapabilitiesLoading: boolean;
  capabilitiesError: string | null;
  commentsEnabled: boolean;
  commentsAuthenticated: boolean;
  commentsTargetLabel: string;
  comments: BoardComment[];
  commentsLoading: boolean;
  commentsMutating: boolean;
  commentsError: string | null;
  commentsActiveCount: number;
  commentsResolvedCount: number;
  refreshComments: () => Promise<void>;
  createComment: (content: string) => Promise<void>;
  replyToComment: (parentCommentId: string, content: string) => Promise<void>;
  resolveComment: (commentId: string) => Promise<void>;
  reopenComment: (commentId: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  votingEnabled: boolean;
  votingAuthenticated: boolean;
  votingSessions: VotingSession[];
  votingSelectedSessionId: string | null;
  votingResults: VotingResults | null;
  votingAvailableTargets: Array<{ id: string; label: string; objectType: string }>;
  votingSelectedTargets: Array<{ id: string; label: string; objectType: string }>;
  votingLocalVotesByTarget: Record<string, number>;
  votingRemainingVotes: number | null;
  votingLoading: boolean;
  votingMutating: boolean;
  votingError: string | null;
  refreshVoting: () => Promise<void>;
  selectVotingSession: (sessionId: string | null) => void;
  createVotingSession: (input: any) => Promise<void>;
  openVotingSession: (sessionId: string) => Promise<void>;
  closeVotingSession: (sessionId: string) => Promise<void>;
  revealVotingSession: (sessionId: string) => Promise<void>;
  cancelVotingSession: (sessionId: string) => Promise<void>;
  castVote: (targetRef: string) => Promise<void>;
  removeVote: (targetRef: string) => Promise<void>;
  sharedTimerEnabled: boolean;
  sharedTimerConnected: boolean;
  sharedTimerCanControl: boolean;
  sharedTimer: import('../../api/timerApi').SharedTimerState | null;
  sharedTimerLabel: string | null;
  sharedTimerDisplay: string;
  sharedTimerState: string | null;
  sharedTimerActive: boolean;
  sharedTimerRemainingMs: number;
  sharedTimerMutating: boolean;
  sharedTimerError: string | null;
  clearSharedTimerError: () => void;
  startSharedTimer: (input: { durationMinutes: number; label?: string | null }) => void;
  pauseSharedTimer: () => void;
  resumeSharedTimer: () => void;
  resetSharedTimer: (durationMinutes?: number) => void;
  cancelSharedTimer: () => void;
  completeSharedTimer: () => void;
};

export const BoardEditorShell: React.FC<BoardEditorShellProps> = ({
  boardId,
  boardName,
  inviteToken,
  serverConfigured,
  oidcConfigured,
  acceptingInvite,
  inviteError,
  inviteAccepted,
  isShareOpen,
  onOpenShare,
  onCloseShare,
  isCommentsOpen,
  onOpenComments,
  onCloseComments,
  isVotingOpen,
  onOpenVoting,
  onCloseVoting,
  isSharedTimerOpen,
  onOpenSharedTimer,
  onCloseSharedTimer,
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
  canCopy,
  canPaste,
  copySelectionToClipboard,
  pasteFromClipboard,
  collab,
  isReadOnly,
  handleCursorWorldMove,
  features,
  isCapabilitiesLoading,
  capabilitiesError,
  commentsEnabled,
  commentsAuthenticated,
  commentsTargetLabel,
  comments,
  commentsLoading,
  commentsMutating,
  commentsError,
  commentsActiveCount,
  commentsResolvedCount,
  refreshComments,
  createComment,
  replyToComment,
  resolveComment,
  reopenComment,
  deleteComment,
  votingEnabled,
  votingAuthenticated,
  votingSessions,
  votingSelectedSessionId,
  votingResults,
  votingAvailableTargets,
  votingSelectedTargets,
  votingLocalVotesByTarget,
  votingRemainingVotes,
  votingLoading,
  votingMutating,
  votingError,
  refreshVoting,
  selectVotingSession,
  createVotingSession,
  openVotingSession,
  closeVotingSession,
  revealVotingSession,
  cancelVotingSession,
  castVote,
  removeVote,
  sharedTimerEnabled,
  sharedTimerConnected,
  sharedTimerCanControl,
  sharedTimer,
  sharedTimerLabel,
  sharedTimerDisplay,
  sharedTimerState,
  sharedTimerActive,
  sharedTimerRemainingMs,
  sharedTimerMutating,
  sharedTimerError,
  clearSharedTimerError,
  startSharedTimer,
  pauseSharedTimer,
  resumeSharedTimer,
  resetSharedTimer,
  cancelSharedTimer,
  completeSharedTimer,
}) => {
  return (
    <section className="page page-board-editor">
      {inviteToken && serverConfigured && oidcConfigured && (
        <div className="collab-notice" role="status" aria-live="polite">
          {acceptingInvite && 'Accepting invite…'}
          {inviteError && `Invite error: ${inviteError}`}
          {inviteAccepted && !acceptingInvite && !inviteError && 'Invite accepted.'}
        </div>
      )}

      {serverConfigured && (
        <div className="feature-gate-banner" role="status" aria-live="polite">
          {isCapabilitiesLoading
            ? 'Checking which server collaboration features are enabled…'
            : capabilitiesError
              ? `Server feature discovery unavailable: ${capabilitiesError}`
              : `Server features: ${[
                  features.supportsComments ? 'comments' : null,
                  features.supportsVoting ? 'voting' : null,
                  features.supportsPublications ? 'publications' : null,
                  features.supportsSharedTimer ? 'shared timer' : null,
                  features.supportsReactions ? 'reactions' : null,
                ]
                  .filter(Boolean)
                  .join(', ') || 'none advertised'}`}
        </div>
      )}

      <BoardEditorHeader
        onOpenShare={onOpenShare}
        collab={{
          status: collab.enabled ? collab.status : 'disabled',
          role: collab.role,
          usersCount: collab.users?.length ?? 0,
          errorText: collab.errorText,
        }}
        boardName={boardName}
        isReadOnly={isReadOnly}
        commentsEnabled={commentsEnabled}
        commentsCount={comments.length}
        onOpenComments={onOpenComments}
        votingEnabled={votingEnabled}
        votingSessionsCount={votingSessions.length}
        onOpenVoting={onOpenVoting}
        sharedTimerEnabled={sharedTimerEnabled}
        sharedTimerLabel={sharedTimerLabel}
        sharedTimerDisplay={sharedTimerActive ? sharedTimerDisplay : null}
        onOpenSharedTimer={onOpenSharedTimer}
        canDelete={canCopy && !isReadOnly}
        canCopy={canCopy}
        canPaste={canPaste}
        onDelete={handleDeleteSelection}
        onCopy={copySelectionToClipboard}
        onPaste={pasteFromClipboard}
      />

      <div className="board-editor-layout">
        <aside className="board-editor-sidebar">
          <ToolSelectorPanel
            toolbox={toolbox}
            isReadOnly={isReadOnly}
            activeToolInstanceId={activeToolInstanceId}
            onChangeToolInstance={setActiveToolInstanceId}
          />

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

          <ExportImportPanel
            canExport={!!state}
            onExportJson={handleExportJson}
            onExportPng={handleExportPng}
            onImportClick={handleImportClick}
            fileInputRef={fileInputRef}
            onImportFileChange={handleImportFileChange}
          />

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

          {sharedTimerEnabled && sharedTimerActive && (
            <div className="shared-timer-banner" role="status" aria-live="polite">
              <div>
                <strong>{sharedTimerLabel || 'Shared timer'}</strong>
                <span> · {sharedTimerState || 'running'}</span>
              </div>
              <div className="shared-timer-banner-readout">{sharedTimerDisplay}</div>
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

      <CommentsDialog
        isOpen={isCommentsOpen}
        boardName={boardName}
        enabled={commentsEnabled}
        authenticated={commentsAuthenticated}
        targetLabel={commentsTargetLabel}
        comments={comments}
        isLoading={commentsLoading}
        isMutating={commentsMutating}
        error={commentsError}
        activeCount={commentsActiveCount}
        resolvedCount={commentsResolvedCount}
        onRefresh={refreshComments}
        onCreateComment={createComment}
        onReplyToComment={replyToComment}
        onResolveComment={resolveComment}
        onReopenComment={reopenComment}
        onDeleteComment={deleteComment}
        onCancel={onCloseComments}
      />

      <VotingDialog
        isOpen={isVotingOpen}
        boardName={boardName}
        enabled={votingEnabled}
        authenticated={votingAuthenticated}
        sessions={votingSessions}
        selectedSessionId={votingSelectedSessionId}
        results={votingResults}
        availableTargets={votingAvailableTargets}
        selectedTargets={votingSelectedTargets}
        localVotesByTarget={votingLocalVotesByTarget}
        remainingVotes={votingRemainingVotes}
        isLoading={votingLoading}
        isMutating={votingMutating}
        error={votingError}
        onRefresh={refreshVoting}
        onSelectSession={selectVotingSession}
        onCreateSession={createVotingSession}
        onOpenSession={openVotingSession}
        onCloseSession={closeVotingSession}
        onRevealSession={revealVotingSession}
        onCancelSession={cancelVotingSession}
        onCastVote={castVote}
        onRemoveVote={removeVote}
        onCancel={onCloseVoting}
      />


      <SharedTimerDialog
        isOpen={isSharedTimerOpen}
        enabled={sharedTimerEnabled}
        connected={sharedTimerConnected}
        canControl={sharedTimerCanControl}
        timer={sharedTimer}
        displayRemainingMs={sharedTimerRemainingMs}
        formattedRemaining={sharedTimerDisplay}
        isMutating={sharedTimerMutating}
        error={sharedTimerError}
        onClearError={clearSharedTimerError}
        onStart={startSharedTimer}
        onPause={pauseSharedTimer}
        onResume={resumeSharedTimer}
        onReset={resetSharedTimer}
        onCancelTimer={cancelSharedTimer}
        onComplete={completeSharedTimer}
        onCancel={onCloseSharedTimer}
      />

      <ShareDialog
        isOpen={isShareOpen}
        boardId={boardId}
        boardName={boardName}
        inviteLink={inviteToken ? `${window.location.origin}/board/${boardId}?invite=${encodeURIComponent(inviteToken)}` : undefined}
        isReadOnly={isReadOnly}
        features={features}
        isCapabilitiesLoading={isCapabilitiesLoading}
        capabilitiesError={capabilitiesError}
        onCancel={onCloseShare}
      />
    </section>
  );
};
