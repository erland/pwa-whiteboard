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
      allowPublishedReaderParticipation: true,
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
        canManage={true}
        canVote={true}
        canRemoveVotes={true}
        participantMode="member"
        participantToken={null}
        canUsePublicationParticipation={false}
        onResetParticipantToken={jest.fn()}
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


test('shows publication participant messaging and reset control for anonymous publication voting', () => {
  render(
    <VotingPanel
      enabled
      authenticated={false}
      boardName="Board A"
      sessions={SESSIONS}
      selectedSessionId="vs-1"
      results={{ session: SESSIONS[0], totalsByTarget: { 'shape-1': 2 }, visibleVotes: [], identitiesHidden: true, progressHidden: true }}
      availableTargets={[{ id: 'shape-1', label: 'Idea A', objectType: 'stickyNote' }]}
      selectedTargets={[]}
      localVotesByTarget={{}}
      remainingVotes={3}
      canManage={false}
      canVote={true}
        canRemoveVotes={true}
      participantMode="publication-reader"
      participantToken="participant-123"
      canUsePublicationParticipation={true}
      onResetParticipantToken={jest.fn()}
      isLoading={false}
      isMutating={false}
      error={null}
      onRefresh={jest.fn()}
      onSelectSession={jest.fn()}
      onCreateSession={jest.fn()}
      onOpenSession={jest.fn()}
      onCloseSession={jest.fn()}
      onRevealSession={jest.fn()}
      onCancelSession={jest.fn()}
      onCastVote={jest.fn()}
      onRemoveVote={jest.fn()}
    />
  );

  expect(screen.getByText(/browser-local participant token/i)).toBeInTheDocument();
  expect(screen.getByText(/published readers can participate/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /reset participant/i })).toBeInTheDocument();
});


test('hides progress totals until the server allows them', () => {
  render(
    <VotingPanel
      enabled
      authenticated
      boardName="Board A"
      sessions={[{ ...SESSIONS[0], rules: { ...SESSIONS[0].rules, allowVoteUpdates: false } }]}
      selectedSessionId="vs-1"
      results={{ session: { ...SESSIONS[0], rules: { ...SESSIONS[0].rules, allowVoteUpdates: false } }, totalsByTarget: { 'shape-1': 2 }, visibleVotes: [], identitiesHidden: true, progressHidden: true }}
      availableTargets={[{ id: 'shape-1', label: 'Idea A', objectType: 'stickyNote' }]}
      selectedTargets={[]}
      localVotesByTarget={{ 'shape-1': 1 }}
      remainingVotes={2}
      canManage={true}
      canVote={true}
      canRemoveVotes={false}
      participantMode="member"
      participantToken={null}
      canUsePublicationParticipation={false}
      onResetParticipantToken={jest.fn()}
      isLoading={false}
      isMutating={false}
      error={null}
      onRefresh={jest.fn()}
      onSelectSession={jest.fn()}
      onCreateSession={jest.fn()}
      onOpenSession={jest.fn()}
      onCloseSession={jest.fn()}
      onRevealSession={jest.fn()}
      onCancelSession={jest.fn()}
      onCastVote={jest.fn()}
      onRemoveVote={jest.fn()}
    />
  );

  expect(screen.getByText(/Result totals are currently hidden by the server/i)).toBeInTheDocument();
  expect(screen.queryByText(/Visible vote records/i)).not.toBeInTheDocument();
  expect(screen.getByText(/Vote updates are disabled/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /remove/i })).toBeDisabled();
});

test('shows visible vote identities only when the server exposes them', () => {
  const nonAnonymousSession = {
    ...SESSIONS[0],
    state: 'revealed' as const,
    rules: {
      ...SESSIONS[0].rules,
      anonymousVotes: false,
      showProgressDuringVoting: true,
    },
    revealedAt: '2026-03-08T11:00:00Z',
  };

  render(
    <VotingPanel
      enabled
      authenticated
      boardName="Board A"
      sessions={[nonAnonymousSession]}
      selectedSessionId="vs-1"
      results={{
        session: nonAnonymousSession,
        totalsByTarget: { 'shape-1': 2 },
        visibleVotes: [{ id: 'vote-1', sessionId: 'vs-1', participantId: 'bob', targetRef: 'shape-1', voteValue: 2, createdAt: null, updatedAt: null }],
        identitiesHidden: false,
        progressHidden: false,
      }}
      availableTargets={[{ id: 'shape-1', label: 'Idea A', objectType: 'stickyNote' }]}
      selectedTargets={[]}
      localVotesByTarget={{}}
      remainingVotes={3}
      canManage={true}
      canVote={false}
      canRemoveVotes={false}
      participantMode="member"
      participantToken={null}
      canUsePublicationParticipation={false}
      onResetParticipantToken={jest.fn()}
      isLoading={false}
      isMutating={false}
      error={null}
      onRefresh={jest.fn()}
      onSelectSession={jest.fn()}
      onCreateSession={jest.fn()}
      onOpenSession={jest.fn()}
      onCloseSession={jest.fn()}
      onRevealSession={jest.fn()}
      onCancelSession={jest.fn()}
      onCastVote={jest.fn()}
      onRemoveVote={jest.fn()}
    />
  );

  expect(screen.getByText(/Results have been revealed/i)).toBeInTheDocument();
  expect(screen.getByText(/Visible vote records/i)).toBeInTheDocument();
  expect(screen.getByText(/Idea A · bob/i)).toBeInTheDocument();
});
