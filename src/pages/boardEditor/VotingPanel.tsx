import React from 'react';
import type { CreateVotingSessionInput, VotingResults, VotingSession } from '../../api/votingApi';

type VotingTarget = {
  id: string;
  label: string;
  objectType: string;
};

type VotingPanelProps = {
  enabled: boolean;
  authenticated: boolean;
  boardName?: string;
  sessions: VotingSession[];
  selectedSessionId: string | null;
  results: VotingResults | null;
  availableTargets: VotingTarget[];
  selectedTargets: VotingTarget[];
  localVotesByTarget: Record<string, number>;
  remainingVotes: number | null;
  canManage: boolean;
  canVote: boolean;
  canRemoveVotes: boolean;
  participantMode: 'member' | 'publication-member' | 'publication-reader' | 'guest';
  participantToken: string | null;
  canUsePublicationParticipation: boolean;
  onResetParticipantToken: () => void;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  onRefresh: () => Promise<void> | void;
  onSelectSession: (sessionId: string | null) => void;
  onCreateSession: (input: CreateVotingSessionInput) => Promise<void> | void;
  onOpenSession: (sessionId: string) => Promise<void> | void;
  onCloseSession: (sessionId: string) => Promise<void> | void;
  onRevealSession: (sessionId: string) => Promise<void> | void;
  onCancelSession: (sessionId: string) => Promise<void> | void;
  onCastVote: (targetRef: string) => Promise<void> | void;
  onRemoveVote: (targetRef: string) => Promise<void> | void;
};

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function scopeLabel(session: VotingSession): string {
  if (session.scopeType === 'object' && session.scopeRef) return `Object ${session.scopeRef}`;
  return session.scopeType;
}

function sessionDisplayName(session: VotingSession, index: number): string {
  const stateLabel = session.state.charAt(0).toUpperCase() + session.state.slice(1);
  return `${stateLabel} session ${index + 1}`;
}

export const VotingPanel: React.FC<VotingPanelProps> = ({
  enabled,
  authenticated,
  boardName,
  sessions,
  selectedSessionId,
  results,
  availableTargets,
  selectedTargets,
  localVotesByTarget,
  remainingVotes,
  canManage,
  canVote,
  canRemoveVotes,
  participantMode,
  participantToken,
  canUsePublicationParticipation,
  onResetParticipantToken,
  isLoading,
  isMutating,
  error,
  onRefresh,
  onSelectSession,
  onCreateSession,
  onOpenSession,
  onCloseSession,
  onRevealSession,
  onCancelSession,
  onCastVote,
  onRemoveVote,
}) => {
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? results?.session ?? null;
  const [scopeType, setScopeType] = React.useState<'board' | 'object'>('board');
  const [maxVotes, setMaxVotes] = React.useState('3');
  const [durationSeconds, setDurationSeconds] = React.useState('');
  const [allowViewerParticipation, setAllowViewerParticipation] = React.useState(true);
  const [allowPublishedReaderParticipation, setAllowPublishedReaderParticipation] = React.useState(false);
  const [anonymousVotes, setAnonymousVotes] = React.useState(true);
  const [showProgressDuringVoting, setShowProgressDuringVoting] = React.useState(false);
  const [allowVoteUpdates, setAllowVoteUpdates] = React.useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [detailsSessionId, setDetailsSessionId] = React.useState<string | null>(null);
  const [showCancelledSessions, setShowCancelledSessions] = React.useState(false);

  React.useEffect(() => {
    if (!isCreateDialogOpen && !detailsSessionId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCreateDialogOpen(false);
        setDetailsSessionId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [detailsSessionId, isCreateDialogOpen]);

  const submitCreateSession = async () => {
    const parsedMaxVotes = Number.parseInt(maxVotes.trim(), 10);
    if (!Number.isFinite(parsedMaxVotes) || parsedMaxVotes <= 0) return;
    const parsedDuration = durationSeconds.trim() ? Number.parseInt(durationSeconds.trim(), 10) : undefined;
    const objectScopeId = selectedTargets[0]?.id;
    await onCreateSession({
      scopeType,
      scopeRef: scopeType === 'object' ? objectScopeId : undefined,
      allowViewerParticipation,
      allowPublishedReaderParticipation,
      maxVotesPerParticipant: parsedMaxVotes,
      anonymousVotes,
      showProgressDuringVoting,
      allowVoteUpdates,
      durationSeconds: parsedDuration,
    });
    setIsCreateDialogOpen(false);
  };

  const resultEntries = React.useMemo(
    () => Object.entries(results?.totalsByTarget ?? {}).sort((a, b) => b[1] - a[1]),
    [results]
  );

  const visibleVoteEntries = React.useMemo(
    () => results?.visibleVotes ?? [],
    [results]
  );
  const progressIsHidden = Boolean(results?.progressHidden);
  const identitiesAreHidden = Boolean(results?.identitiesHidden);
  const showResultTotals = Boolean(results && !progressIsHidden);
  const showVisibleVotes = Boolean(results && !progressIsHidden && !identitiesAreHidden && visibleVoteEntries.length > 0);
  const liveSessionCount = sessions.filter((session) => session.state === 'open').length;
  const selectedSessionIndex = selectedSession ? sessions.findIndex((session) => session.id === selectedSession.id) : -1;
  const selectedSessionName = selectedSession && selectedSessionIndex >= 0
    ? sessionDisplayName(selectedSession, selectedSessionIndex)
    : selectedSession
      ? `${selectedSession.state.charAt(0).toUpperCase() + selectedSession.state.slice(1)} session`
      : null;
  const visibleSessions = React.useMemo(
    () => showCancelledSessions ? sessions : sessions.filter((session) => session.state !== 'cancelled'),
    [sessions, showCancelledSessions]
  );
  const cancelledSessionCount = sessions.length - visibleSessions.length;
  const detailsSession = detailsSessionId ? sessions.find((session) => session.id === detailsSessionId) ?? null : null;
  const detailsSessionIndex = detailsSession ? sessions.findIndex((session) => session.id === detailsSession.id) : -1;
  const detailsSessionName = detailsSession && detailsSessionIndex >= 0
    ? sessionDisplayName(detailsSession, detailsSessionIndex)
    : null;
  const votingPhaseMessage = selectedSession
    ? selectedSession.state === 'revealed'
      ? 'Results have been revealed. This is the final server-published outcome for the session.'
      : selectedSession.state === 'closed'
        ? 'Voting is closed. Results are now available from the server.'
        : selectedSession.state === 'open' && progressIsHidden
          ? 'Progress is hidden during voting for this session.'
          : selectedSession.state === 'open'
            ? 'Live progress is visible during voting for this session.'
            : selectedSession.state === 'draft'
              ? 'This voting session is still a draft and has not opened yet.'
              : selectedSession.state === 'cancelled'
                ? 'This voting session was cancelled.'
                : null
    : null;

  if (!enabled) {
    return (
      <section className="share-panel">
        <h3>Voting</h3>
        <div className="share-help">This server has not advertised voting support for this board.</div>
      </section>
    );
  }

  return (
    <section className="share-panel">
      <h3>Voting</h3>

      <div className="share-section">
        <div className="share-label">Voting context</div>
        <div className="share-help">Board: <code>{boardName || 'Untitled board'}</code></div>
        <div className="capability-chip-list">
          <span className="capability-chip" data-enabled={sessions.length > 0 ? 'true' : 'false'}>Sessions {sessions.length}</span>
          <span className="capability-chip" data-enabled={Boolean(selectedSession && selectedSession.state === 'open')}>Open {liveSessionCount}</span>
          <button type="button" className="tool-button" onClick={() => void onRefresh()} disabled={isLoading || isMutating}>
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="share-section">
        <div className="share-label">Create voting session</div>
        {!canManage ? (
          <div className="share-help">{participantMode === 'publication-reader' ? 'Published readers can participate in eligible sessions but cannot create or manage voting sessions from this view.' : 'Sign in to create and manage voting sessions.'}</div>
        ) : (
          <div className="voting-create-inline">
            <div className="share-help">
              Open a compact setup dialog to create a new voting session without pushing the session list off-screen.
            </div>
            <div className="capability-chip-list">
              <span className="comment-status-badge">Default max votes {maxVotes}</span>
              <span className="comment-status-badge">Open sessions {liveSessionCount}</span>
              <button type="button" className="tool-button" onClick={() => setIsCreateDialogOpen(true)} disabled={isMutating}>
                New session…
              </button>
            </div>
            {scopeType === 'object' && selectedTargets.length > 0 && (
              <div className="share-help">Current object target: {selectedTargets[0]?.label}</div>
            )}
          </div>
        )}
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="share-section">
        <div className="share-publication-header">
          <div className="share-label">Sessions</div>
          <div className="comment-reply-actions">
            {cancelledSessionCount > 0 && (
              <button
                type="button"
                className="tool-button"
                onClick={() => setShowCancelledSessions((current) => !current)}
                aria-pressed={showCancelledSessions}
              >
                {showCancelledSessions ? 'Hide cancelled' : `Show cancelled (${cancelledSessionCount})`}
              </button>
            )}
          </div>
        </div>
        {visibleSessions.length === 0 ? (
          <div className="share-help">No voting sessions yet.</div>
        ) : (
          <div className="voting-session-table" role="table" aria-label="Voting sessions">
            <div className="voting-session-table__header" role="row">
              <span>Name</span>
              <span>State</span>
              <span>Scope</span>
              <span>Votes</span>
              <span>Updated</span>
              <span>Actions</span>
            </div>
            {visibleSessions.map((session) => {
              const sessionIndex = sessions.findIndex((candidate) => candidate.id === session.id);
              const isSelected = session.id === selectedSessionId;
              return (
                <div key={session.id} className="voting-session-row" data-selected={isSelected ? 'true' : 'false'} role="row">
                  <button type="button" className="voting-session-row__name" onClick={() => onSelectSession(session.id)}>
                    <strong>{sessionDisplayName(session, sessionIndex >= 0 ? sessionIndex : 0)}</strong>
                  </button>
                  <span><span className="comment-status-badge">{session.state}</span></span>
                  <span>{scopeLabel(session)}</span>
                  <span>{session.rules.maxVotesPerParticipant}</span>
                  <span>{formatTimestamp(session.updatedAt || session.createdAt)}</span>
                  <div className="voting-session-row__actions">
                    {!isSelected && (
                      <button type="button" className="tool-button" onClick={() => onSelectSession(session.id)}>Select</button>
                    )}
                    <button type="button" className="tool-button" onClick={() => setDetailsSessionId(session.id)}>Details…</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedSession && (
        <div className="share-section">
          <div className="share-label">Participant voting</div>
          {participantMode === 'guest' ? (
            <div className="share-help">Sign in to cast votes on open sessions.</div>
          ) : selectedSession.state !== 'open' ? (
            <div className="share-help">This session is not open for voting right now.</div>
          ) : participantMode === 'publication-reader' && !selectedSession.rules.allowPublishedReaderParticipation ? (
            <div className="share-help">This published session is view-only. Publication readers cannot vote in this session.</div>
          ) : (
            <>
              {participantMode === 'publication-reader' && (
                <div className="publication-voting-note">
                  <div className="share-help">This publication uses a browser-local participant token so your votes can be associated when you reopen the same link.</div>
                  <div className="comment-reply-actions">
                    <span className="comment-status-badge">Stored participant {participantToken ? 'ready' : 'missing'}</span>
                    <button type="button" className="tool-button" onClick={onResetParticipantToken} disabled={isMutating}>
                      Reset participant
                    </button>
                  </div>
                </div>
              )}
              {!canVote ? (
                <div className="share-help">Voting is not available for your current access mode.</div>
              ) : (
                <>
                  <div className="share-help">
                    Remaining votes: <strong>{remainingVotes ?? '—'}</strong>
                  </div>
                  {!selectedSession.rules.allowVoteUpdates && (
                    <div className="share-help">Vote updates are disabled for this session. Once a vote is cast, it cannot be removed or changed.</div>
                  )}
                  {selectedTargets.length > 0 && (
                    <div className="share-help">Selected objects on canvas: {selectedTargets.map((target) => target.label).join(', ')}</div>
                  )}
                  {availableTargets.length === 0 ? (
                    <div className="share-help">There are no board objects to vote on yet.</div>
                  ) : (
                    <div className="voting-target-list">
                      {availableTargets.map((target) => {
                        const voteCount = localVotesByTarget[target.id] ?? 0;
                        return (
                          <div key={target.id} className="voting-target-card">
                            <div>
                              <strong>{target.label}</strong>
                              <div className="share-help">{target.objectType} · {target.id}</div>
                            </div>
                            <div className="comment-reply-actions">
                              <button
                                type="button"
                                className="tool-button"
                                onClick={() => void onCastVote(target.id)}
                                disabled={isMutating || (remainingVotes ?? 0) <= 0 || !canUsePublicationParticipation && participantMode === 'publication-reader'}
                              >
                                Vote +1
                              </button>
                              <button
                                type="button"
                                className="tool-button"
                                onClick={() => void onRemoveVote(target.id)}
                                disabled={isMutating || voteCount <= 0 || !canRemoveVotes || !canUsePublicationParticipation && participantMode === 'publication-reader'}
                              >
                                Remove
                              </button>
                              <span className="comment-status-badge">Your votes {voteCount}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {selectedSession && results && (
        <div className="share-section">
          <div className="share-label">Results</div>
          {votingPhaseMessage && <div className="share-help">{votingPhaseMessage}</div>}
          {progressIsHidden ? (
            <div className="share-help">Result totals are currently hidden by the server for this audience.</div>
          ) : resultEntries.length === 0 ? (
            <div className="share-help">No visible results yet.</div>
          ) : (
            <div className="voting-results-list">
              {resultEntries.map(([targetRef, total]) => (
                <div key={targetRef} className="voting-result-row">
                  <span>{availableTargets.find((target) => target.id === targetRef)?.label ?? targetRef}</span>
                  <strong>{total}</strong>
                </div>
              ))}
            </div>
          )}
          {showResultTotals && identitiesAreHidden && (
            <div className="share-help">Individual voter identities are hidden for this session.</div>
          )}
          {showVisibleVotes && (
            <>
              <div className="share-help">Visible vote records</div>
              <div className="voting-results-list">
                {visibleVoteEntries.map((vote) => (
                  <div key={vote.id} className="voting-result-row">
                    <span>
                      {(availableTargets.find((target) => target.id === vote.targetRef)?.label ?? vote.targetRef)}
                      {' · '}
                      {vote.participantId ?? 'Unknown participant'}
                    </span>
                    <strong>{vote.voteValue}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {detailsSession && detailsSessionName && (
        <div
          className="modal-backdrop voting-create-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDetailsSessionId(null);
          }}
        >
          <div className="modal voting-create-modal" role="dialog" aria-modal="true" aria-label="Voting session details">
            <div className="modal-header">
              <h4>{detailsSessionName}</h4>
            </div>
            <div className="modal-body voting-create-modal-body">
              <div className="share-publication-card voting-session-detail-card" data-state={detailsSession.state}>
                <div className="share-publication-header">
                  <strong>{detailsSessionName}</strong>
                  <span className="comment-status-badge">{detailsSession.state}</span>
                </div>
                <div className="share-help">Scope: {scopeLabel(detailsSession)}</div>
                <div className="share-help">Created: {formatTimestamp(detailsSession.createdAt)}</div>
                <div className="share-help">Updated: {formatTimestamp(detailsSession.updatedAt)}</div>
                <div className="share-help">Progress during voting: {detailsSession.rules.showProgressDuringVoting ? 'Visible' : 'Hidden until close/reveal for non-facilitators'}</div>
                <div className="share-help">Vote identities: {detailsSession.rules.anonymousVotes ? 'Hidden during voting and only revealed to facilitators after close' : 'Visible when progress is visible'}</div>
                <div className="share-help">Vote updates: {detailsSession.rules.allowVoteUpdates ? 'Allowed' : 'Locked after a vote is cast'}</div>
                {detailsSession.state === 'cancelled' && (
                  <div className="share-help">Cancelled sessions are hidden from the main list by default. Permanent deletion is not supported by the current server API.</div>
                )}
                {detailsSession.rules.durationSeconds ? (
                  <div className="share-help">Duration: {detailsSession.rules.durationSeconds} seconds</div>
                ) : null}
              </div>
            </div>
            <div className="modal-footer">
              {!selectedSession || selectedSession.id !== detailsSession.id ? (
                <button type="button" className="tool-button" onClick={() => { onSelectSession(detailsSession.id); setDetailsSessionId(null); }} disabled={isMutating}>Select session</button>
              ) : null}
              {canManage && detailsSession.state === 'draft' && (
                <button type="button" className="tool-button" onClick={() => void onOpenSession(detailsSession.id)} disabled={isMutating}>Start voting</button>
              )}
              {canManage && detailsSession.state === 'open' && (
                <button type="button" className="tool-button" onClick={() => void onCloseSession(detailsSession.id)} disabled={isMutating}>End voting</button>
              )}
              {canManage && detailsSession.state === 'closed' && (
                <button type="button" className="tool-button" onClick={() => void onRevealSession(detailsSession.id)} disabled={isMutating}>Reveal</button>
              )}
              {canManage && detailsSession.state !== 'cancelled' && detailsSession.state !== 'revealed' && (
                <button type="button" className="tool-button" onClick={() => void onCancelSession(detailsSession.id)} disabled={isMutating}>Cancel</button>
              )}
              <button type="button" className="tool-button" onClick={() => setDetailsSessionId(null)} disabled={isMutating}>Close</button>
            </div>
          </div>
        </div>
      )}

      {canManage && isCreateDialogOpen && (
        <div
          className="modal-backdrop voting-create-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsCreateDialogOpen(false);
          }}
        >
          <div className="modal voting-create-modal" role="dialog" aria-modal="true" aria-label="Create voting session">
            <div className="modal-header">
              <h4>Create voting session</h4>
            </div>
            <div className="modal-body voting-create-modal-body">
              <div className="share-help">Configure the session here so the voting tab can keep the sessions list visible underneath.</div>
              <div className="voting-form-grid">
                <label className="form-field">
                  <span>Scope</span>
                  <select className="text-input" value={scopeType} onChange={(e) => setScopeType(e.currentTarget.value as 'board' | 'object')}>
                    <option value="board">Board</option>
                    <option value="object" disabled={selectedTargets.length === 0}>Selected object</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>Max votes per participant</span>
                  <input className="text-input" type="number" min={1} value={maxVotes} onChange={(e) => setMaxVotes(e.currentTarget.value)} />
                </label>
                <label className="form-field">
                  <span>Duration seconds</span>
                  <input className="text-input" type="number" min={1} placeholder="Optional" value={durationSeconds} onChange={(e) => setDurationSeconds(e.currentTarget.value)} />
                </label>
                <label className="checkbox-field"><input type="checkbox" checked={allowViewerParticipation} onChange={(e) => setAllowViewerParticipation(e.currentTarget.checked)} /> Allow viewers</label>
                <label className="checkbox-field"><input type="checkbox" checked={allowPublishedReaderParticipation} onChange={(e) => setAllowPublishedReaderParticipation(e.currentTarget.checked)} /> Allow publication readers</label>
                <label className="checkbox-field"><input type="checkbox" checked={anonymousVotes} onChange={(e) => setAnonymousVotes(e.currentTarget.checked)} /> Anonymous votes</label>
                <label className="checkbox-field"><input type="checkbox" checked={showProgressDuringVoting} onChange={(e) => setShowProgressDuringVoting(e.currentTarget.checked)} /> Show progress during voting</label>
                <label className="checkbox-field"><input type="checkbox" checked={allowVoteUpdates} onChange={(e) => setAllowVoteUpdates(e.currentTarget.checked)} /> Allow vote updates</label>
                {scopeType === 'object' && (
                  <div className="share-help">Object scope target: {selectedTargets[0]?.label ?? 'Select one object on the canvas first.'}</div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="tool-button" onClick={() => setIsCreateDialogOpen(false)} disabled={isMutating}>Cancel</button>
              <button
                type="button"
                className="tool-button"
                onClick={() => void submitCreateSession()}
                disabled={isMutating || (scopeType === 'object' && selectedTargets.length === 0)}
              >
                {isMutating ? 'Saving…' : 'Create session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
