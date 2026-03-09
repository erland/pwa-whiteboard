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
  };

  const resultEntries = React.useMemo(
    () => Object.entries(results?.totalsByTarget ?? {}).sort((a, b) => b[1] - a[1]),
    [results]
  );

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
          <span className="capability-chip" data-enabled={Boolean(selectedSession && selectedSession.state === 'open')}>Open {sessions.filter((session) => session.state === 'open').length}</span>
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
            <div className="comment-reply-actions">
              <button
                type="button"
                className="tool-button"
                onClick={submitCreateSession}
                disabled={isMutating || (scopeType === 'object' && selectedTargets.length === 0)}
              >
                {isMutating ? 'Saving…' : 'Create session'}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="share-section">
        <div className="share-label">Sessions</div>
        {sessions.length === 0 ? (
          <div className="share-help">No voting sessions yet.</div>
        ) : (
          <div className="voting-session-list">
            {sessions.map((session) => (
              <button
                type="button"
                key={session.id}
                className="voting-session-card"
                data-selected={session.id === selectedSessionId ? 'true' : 'false'}
                onClick={() => onSelectSession(session.id)}
              >
                <div className="share-publication-header">
                  <strong>{session.id}</strong>
                  <span className="comment-status-badge">{session.state}</span>
                </div>
                <div className="share-help">Scope: {scopeLabel(session)}</div>
                <div className="share-help">Max votes: {session.rules.maxVotesPerParticipant}</div>
                <div className="share-help">Updated: {formatTimestamp(session.updatedAt || session.createdAt)}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedSession && (
        <div className="share-section">
          <div className="share-label">Selected session</div>
          <div className="share-publication-card" data-state={selectedSession.state}>
            <div className="share-publication-header">
              <strong>{selectedSession.id}</strong>
              <span className="comment-status-badge">{selectedSession.state}</span>
            </div>
            <div className="share-help">Scope: {scopeLabel(selectedSession)}</div>
            <div className="share-help">Created: {formatTimestamp(selectedSession.createdAt)}</div>
            <div className="share-help">Updated: {formatTimestamp(selectedSession.updatedAt)}</div>
            <div className="capability-chip-list">
              {canManage && selectedSession.state === 'draft' && (
                <button type="button" className="tool-button" onClick={() => void onOpenSession(selectedSession.id)} disabled={isMutating}>Open</button>
              )}
              {canManage && selectedSession.state === 'open' && (
                <button type="button" className="tool-button" onClick={() => void onCloseSession(selectedSession.id)} disabled={isMutating}>Close</button>
              )}
              {canManage && selectedSession.state === 'closed' && (
                <button type="button" className="tool-button" onClick={() => void onRevealSession(selectedSession.id)} disabled={isMutating}>Reveal</button>
              )}
              {canManage && selectedSession.state !== 'cancelled' && selectedSession.state !== 'revealed' && (
                <button type="button" className="tool-button" onClick={() => void onCancelSession(selectedSession.id)} disabled={isMutating}>Cancel</button>
              )}
            </div>
          </div>
        </div>
      )}

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
                                disabled={isMutating || voteCount <= 0 || !canUsePublicationParticipation && participantMode === 'publication-reader'}
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
          {resultEntries.length === 0 ? (
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
        </div>
      )}
    </section>
  );
};
