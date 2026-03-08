import React, { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { VotingPanel } from '../VotingPanel';

const SESSIONS = [
  {
    id: 'vs-1',
    boardId: 'b-1',
    scopeType: 'board' as const,
    scopeRef: null,
    state: 'open' as const,
    createdByUserId: 'alice',
    rules: {
      allowViewerParticipation: true,
      allowPublishedReaderParticipation: false,
      maxVotesPerParticipant: 3,
      anonymousVotes: true,
      showProgressDuringVoting: false,
      allowVoteUpdates: true,
      durationSeconds: null,
    },
    createdAt: '2026-03-08T10:00:00Z',
    updatedAt: '2026-03-08T10:00:00Z',
    openedAt: '2026-03-08T10:00:00Z',
    closedAt: null,
    revealedAt: null,
  },
];

describe('VotingPanel', () => {
  test('renders sessions, creates new sessions, and casts votes', async () => {
    const onCreateSession = jest.fn();
    const onCastVote = jest.fn();

    render(
      <VotingPanel
        enabled
        authenticated
        boardName="Board A"
        sessions={SESSIONS}
        selectedSessionId="vs-1"
        results={{ session: SESSIONS[0], totalsByTarget: { 'shape-1': 2 }, visibleVotes: [], identitiesHidden: true, progressHidden: true }}
        availableTargets={[{ id: 'shape-1', label: 'Idea A', objectType: 'stickyNote' }]}
        selectedTargets={[{ id: 'shape-1', label: 'Idea A', objectType: 'stickyNote' }]}
        localVotesByTarget={{}}
        remainingVotes={3}
        isLoading={false}
        isMutating={false}
        error={null}
        onRefresh={jest.fn()}
        onSelectSession={jest.fn()}
        onCreateSession={onCreateSession}
        onOpenSession={jest.fn()}
        onCloseSession={jest.fn()}
        onRevealSession={jest.fn()}
        onCancelSession={jest.fn()}
        onCastVote={onCastVote}
        onRemoveVote={jest.fn()}
      />
    );

    expect(screen.getAllByText('vs-1').length).toBeGreaterThan(0);
    expect(screen.getByText(/Remaining votes/)).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('3'), { target: { value: '5' } });
    await act(async () => {
      fireEvent.click(screen.getByText('Create session'));
    });
    expect(onCreateSession).toHaveBeenCalledWith(expect.objectContaining({ maxVotesPerParticipant: 5 }));

    await act(async () => {
      fireEvent.click(screen.getByText('Vote +1'));
    });
    expect(onCastVote).toHaveBeenCalledWith('shape-1');
  });
});
