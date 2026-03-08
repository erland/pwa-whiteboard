import React from 'react';
import { CommentsPanel } from './CommentsPanel';
import { VotingPanel } from './VotingPanel';
import { SharedTimerPanel } from './SharedTimerPanel';
import type { BoardComment } from '../../api/commentsApi';
import type { VotingResults, VotingSession } from '../../api/votingApi';
import type { SharedTimerState } from '../../api/timerApi';

type VotingTarget = {
  id: string;
  label: string;
  objectType: string;
};

export type FacilitationTab = 'overview' | 'comments' | 'voting' | 'timer';

type Props = {
  isOpen: boolean;
  boardName?: string;
  activeTab: FacilitationTab;
  onChangeTab: (tab: FacilitationTab) => void;
  commentsEnabled: boolean;
  commentsAuthenticated: boolean;
  commentsTargetLabel: string;
  comments: BoardComment[];
  commentsLoading: boolean;
  commentsMutating: boolean;
  commentsError: string | null;
  commentsActiveCount: number;
  commentsResolvedCount: number;
  onRefreshComments: () => Promise<void> | void;
  onCreateComment: (content: string) => Promise<void> | void;
  onReplyToComment: (parentCommentId: string, content: string) => Promise<void> | void;
  onResolveComment: (commentId: string) => Promise<void> | void;
  onReopenComment: (commentId: string) => Promise<void> | void;
  onDeleteComment: (commentId: string) => Promise<void> | void;
  votingEnabled: boolean;
  votingAuthenticated: boolean;
  votingSessions: VotingSession[];
  votingSelectedSessionId: string | null;
  votingResults: VotingResults | null;
  votingAvailableTargets: VotingTarget[];
  votingSelectedTargets: VotingTarget[];
  votingLocalVotesByTarget: Record<string, number>;
  votingRemainingVotes: number | null;
  votingLoading: boolean;
  votingMutating: boolean;
  votingError: string | null;
  onRefreshVoting: () => Promise<void> | void;
  onSelectVotingSession: (sessionId: string | null) => void;
  onCreateVotingSession: (input: any) => Promise<void> | void;
  onOpenVotingSession: (sessionId: string) => Promise<void> | void;
  onCloseVotingSession: (sessionId: string) => Promise<void> | void;
  onRevealVotingSession: (sessionId: string) => Promise<void> | void;
  onCancelVotingSession: (sessionId: string) => Promise<void> | void;
  onCastVote: (targetRef: string) => Promise<void> | void;
  onRemoveVote: (targetRef: string) => Promise<void> | void;
  sharedTimerEnabled: boolean;
  sharedTimerConnected: boolean;
  sharedTimerCanControl: boolean;
  sharedTimer: SharedTimerState | null;
  sharedTimerDisplay: string;
  sharedTimerRemainingMs: number;
  sharedTimerMutating: boolean;
  sharedTimerError: string | null;
  onClearSharedTimerError: () => void;
  onStartSharedTimer: (input: { durationMinutes: number; label?: string | null }) => void;
  onPauseSharedTimer: () => void;
  onResumeSharedTimer: () => void;
  onResetSharedTimer: (durationMinutes?: number) => void;
  onCancelSharedTimer: () => void;
  onCompleteSharedTimer: () => void;
  reactionsEnabled: boolean;
  onCancel: () => void;
};

const TAB_ORDER: FacilitationTab[] = ['overview', 'comments', 'voting', 'timer'];

export const FacilitationDialog: React.FC<Props> = ({
  isOpen,
  boardName,
  activeTab,
  onChangeTab,
  commentsEnabled,
  commentsAuthenticated,
  commentsTargetLabel,
  comments,
  commentsLoading,
  commentsMutating,
  commentsError,
  commentsActiveCount,
  commentsResolvedCount,
  onRefreshComments,
  onCreateComment,
  onReplyToComment,
  onResolveComment,
  onReopenComment,
  onDeleteComment,
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
  onRefreshVoting,
  onSelectVotingSession,
  onCreateVotingSession,
  onOpenVotingSession,
  onCloseVotingSession,
  onRevealVotingSession,
  onCancelVotingSession,
  onCastVote,
  onRemoveVote,
  sharedTimerEnabled,
  sharedTimerConnected,
  sharedTimerCanControl,
  sharedTimer,
  sharedTimerDisplay,
  sharedTimerRemainingMs,
  sharedTimerMutating,
  sharedTimerError,
  onClearSharedTimerError,
  onStartSharedTimer,
  onPauseSharedTimer,
  onResumeSharedTimer,
  onResetSharedTimer,
  onCancelSharedTimer,
  onCompleteSharedTimer,
  reactionsEnabled,
  onCancel,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
      if ((event.metaKey || event.ctrlKey) && !event.altKey) {
        if (event.key === '1') onChangeTab('overview');
        if (event.key === '2' && commentsEnabled) onChangeTab('comments');
        if (event.key === '3' && votingEnabled) onChangeTab('voting');
        if (event.key === '4' && sharedTimerEnabled) onChangeTab('timer');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commentsEnabled, isOpen, onCancel, onChangeTab, sharedTimerEnabled, votingEnabled]);

  const availableTabs = React.useMemo(
    () =>
      TAB_ORDER.filter((tab) => {
        if (tab === 'comments') return commentsEnabled;
        if (tab === 'voting') return votingEnabled;
        if (tab === 'timer') return sharedTimerEnabled;
        return true;
      }),
    [commentsEnabled, sharedTimerEnabled, votingEnabled]
  );

  React.useEffect(() => {
    if (!isOpen) return;
    if (availableTabs.includes(activeTab)) return;
    onChangeTab(availableTabs[0] ?? 'overview');
  }, [activeTab, availableTabs, isOpen, onChangeTab]);

  if (!isOpen) return null;

  const liveVotingSessions = votingSessions.filter((session) => session.state === 'open').length;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="modal modal-xl" role="dialog" aria-modal="true" aria-label="Facilitation workspace">
        <div className="modal-header">
          <div>
            <h2>Facilitation</h2>
            <p className="facilitation-dialog-subtitle">Review, voting, and shared timing for {boardName || 'this board'}.</p>
          </div>
        </div>

        <div className="facilitation-tabs" role="tablist" aria-label="Facilitation sections">
          <button type="button" role="tab" aria-selected={activeTab === 'overview'} className="facilitation-tab" onClick={() => onChangeTab('overview')}>
            Overview
          </button>
          {commentsEnabled && (
            <button type="button" role="tab" aria-selected={activeTab === 'comments'} className="facilitation-tab" onClick={() => onChangeTab('comments')}>
              Comments
            </button>
          )}
          {votingEnabled && (
            <button type="button" role="tab" aria-selected={activeTab === 'voting'} className="facilitation-tab" onClick={() => onChangeTab('voting')}>
              Voting
            </button>
          )}
          {sharedTimerEnabled && (
            <button type="button" role="tab" aria-selected={activeTab === 'timer'} className="facilitation-tab" onClick={() => onChangeTab('timer')}>
              Timer
            </button>
          )}
        </div>

        <div className="modal-body">
          {activeTab === 'overview' && (
            <div className="facilitation-overview">
              <div className="facilitation-overview-grid">
                <section className="facilitation-summary-card">
                  <h3>Comments</h3>
                  <p>{commentsEnabled ? `${commentsActiveCount} active · ${commentsResolvedCount} resolved` : 'Not available on this server.'}</p>
                  <div className="form-help">Target: {commentsTargetLabel}</div>
                  <button type="button" className="tool-button" onClick={() => onChangeTab('comments')} disabled={!commentsEnabled}>
                    Open comments
                  </button>
                </section>

                <section className="facilitation-summary-card">
                  <h3>Voting</h3>
                  <p>{votingEnabled ? `${votingSessions.length} sessions · ${liveVotingSessions} live` : 'Not available on this server.'}</p>
                  <div className="form-help">Selected targets: {votingSelectedTargets.length || 'board scope'}</div>
                  <button type="button" className="tool-button" onClick={() => onChangeTab('voting')} disabled={!votingEnabled}>
                    Open voting
                  </button>
                </section>

                <section className="facilitation-summary-card">
                  <h3>Shared timer</h3>
                  <p>
                    {sharedTimerEnabled
                      ? sharedTimer
                        ? `${sharedTimer.state || 'running'} · ${sharedTimerDisplay}`
                        : sharedTimerConnected
                          ? 'Ready to start'
                          : 'Connect to collaborate'
                      : 'Not available on this server.'}
                  </p>
                  <div className="form-help">{sharedTimerCanControl ? 'You can control the timer.' : 'You can view the shared timer.'}</div>
                  <button type="button" className="tool-button" onClick={() => onChangeTab('timer')} disabled={!sharedTimerEnabled}>
                    Open timer
                  </button>
                </section>
              </div>

              <div className="facilitation-overview-notes">
                <strong>Live cues</strong>
                <p>
                  {reactionsEnabled
                    ? 'Quick reactions, cursors, viewport updates, and participant activity are active directly in the editor header and canvas.'
                    : 'This server does not currently advertise reactions, but comments, voting, and timer support remain available below.'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'comments' && commentsEnabled && (
            <CommentsPanel
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
              onRefresh={onRefreshComments}
              onCreateComment={onCreateComment}
              onReplyToComment={onReplyToComment}
              onResolveComment={onResolveComment}
              onReopenComment={onReopenComment}
              onDeleteComment={onDeleteComment}
            />
          )}

          {activeTab === 'voting' && votingEnabled && (
            <VotingPanel
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
              onRefresh={onRefreshVoting}
              onSelectSession={onSelectVotingSession}
              onCreateSession={onCreateVotingSession}
              onOpenSession={onOpenVotingSession}
              onCloseSession={onCloseVotingSession}
              onRevealSession={onRevealVotingSession}
              onCancelSession={onCancelVotingSession}
              onCastVote={onCastVote}
              onRemoveVote={onRemoveVote}
            />
          )}

          {activeTab === 'timer' && sharedTimerEnabled && (
            <SharedTimerPanel
              enabled={sharedTimerEnabled}
              connected={sharedTimerConnected}
              canControl={sharedTimerCanControl}
              timer={sharedTimer}
              displayRemainingMs={sharedTimerRemainingMs}
              formattedRemaining={sharedTimerDisplay}
              isMutating={sharedTimerMutating}
              error={sharedTimerError}
              onClearError={onClearSharedTimerError}
              onStart={onStartSharedTimer}
              onPause={onPauseSharedTimer}
              onResume={onResumeSharedTimer}
              onReset={onResetSharedTimer}
              onCancelTimer={onCancelSharedTimer}
              onComplete={onCompleteSharedTimer}
            />
          )}
        </div>

        <div className="modal-footer">
          <span className="form-help facilitation-shortcuts">Tips: Ctrl/Cmd+1 Overview · 2 Comments · 3 Voting · 4 Timer</span>
          <button type="button" className="tool-button" onClick={onCancel}>Close</button>
        </div>
      </div>
    </div>
  );
};
