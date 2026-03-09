import React, { act } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useBoardVoting } from '../useBoardVoting';
import { createBoardAccessContext } from '../publicationSession';

const mockListSessions = jest.fn();
const mockGetResults = jest.fn();
const mockCreateSession = jest.fn();
const mockCastVote = jest.fn();
const mockRemoveVote = jest.fn();
const mockOpenSession = jest.fn();
const mockCloseSession = jest.fn();
const mockRevealSession = jest.fn();
const mockCancelSession = jest.fn();

jest.mock('../../../api/votingApi', () => ({
  createVotingApi: () => ({
    listSessions: (...args: unknown[]) => mockListSessions(...args),
    getResults: (...args: unknown[]) => mockGetResults(...args),
    createSession: (...args: unknown[]) => mockCreateSession(...args),
    castVote: (...args: unknown[]) => mockCastVote(...args),
    removeVote: (...args: unknown[]) => mockRemoveVote(...args),
    openSession: (...args: unknown[]) => mockOpenSession(...args),
    closeSession: (...args: unknown[]) => mockCloseSession(...args),
    revealSession: (...args: unknown[]) => mockRevealSession(...args),
    cancelSession: (...args: unknown[]) => mockCancelSession(...args),
  }),
}));

function HookProbe(props: { publicationToken?: string | null; authenticated?: boolean } = {}) {
  const state = useBoardVoting({
    boardId: 'board-1',
    enabled: true,
    authenticated: props.authenticated ?? true,
    selectedObjectIds: ['shape-1'],
    objects: [
      { id: 'shape-1', type: 'stickyNote', x: 0, y: 0, text: 'Idea A' },
      { id: 'shape-2', type: 'rectangle', x: 10, y: 10 },
    ],
    access: createBoardAccessContext({
      publicationSession: props.publicationToken
        ? {
            token: props.publicationToken,
            id: 'pub-1',
            boardId: 'board-1',
            targetType: 'board',
            snapshotVersion: null,
            allowComments: false,
            state: 'active',
            createdAt: '2026-03-08T10:00:00Z',
            updatedAt: '2026-03-08T10:00:00Z',
            expiresAt: null,
          }
        : null,
    }),
  });

  return (
    <div>
      <div data-testid="sessions-count">{state.sessions.length}</div>
      <div data-testid="selected-target">{state.selectedTargets[0]?.label ?? ''}</div>
      <div data-testid="remaining-votes">{String(state.remainingVotes ?? '')}</div>
      <div data-testid="participant-mode">{state.participantMode}</div>
      <div data-testid="participant-token">{state.participantToken ?? ''}</div>
      <div data-testid="can-remove-votes">{String(state.canRemoveVotes)}</div>
      <button onClick={() => void state.createSession({ scopeType: 'object', scopeRef: 'shape-1', maxVotesPerParticipant: 3 })}>create</button>
      <button onClick={() => void state.castVote('shape-1')}>vote</button>
      <button onClick={() => void state.removeVote('shape-1')}>remove</button>
      <button onClick={() => state.resetParticipantToken()}>reset participant</button>
    </div>
  );
}

describe('useBoardVoting', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockListSessions.mockReset();
    mockGetResults.mockReset();
    mockCreateSession.mockReset();
    mockCastVote.mockReset();
    mockRemoveVote.mockReset();
    mockOpenSession.mockReset();
    mockCloseSession.mockReset();
    mockRevealSession.mockReset();
    mockCancelSession.mockReset();

    mockListSessions.mockResolvedValue([
      {
        id: 'vs-1',
        boardId: 'board-1',
        scopeType: 'board',
        scopeRef: null,
        state: 'open',
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
    ]);
    mockGetResults.mockResolvedValue({
      session: {
        id: 'vs-1',
        boardId: 'board-1',
        scopeType: 'board',
        scopeRef: null,
        state: 'open',
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
      },
      totalsByTarget: { 'shape-1': 2 },
      visibleVotes: [],
      identitiesHidden: true,
      progressHidden: true,
    });
    mockCreateSession.mockResolvedValue({ id: 'vs-2' });
    mockCastVote.mockResolvedValue({ voteValue: 1 });
    mockRemoveVote.mockResolvedValue(undefined);
  });

  test('loads sessions and uses selected object label as voting context', async () => {
    render(<HookProbe />);

    await waitFor(() => expect(screen.getByTestId('sessions-count')).toHaveTextContent('1'));
    expect(screen.getByTestId('selected-target')).toHaveTextContent('Idea A');
  });

  test('creates sessions and tracks optimistic vote usage for member access', async () => {
    render(<HookProbe />);

    await waitFor(() => expect(mockListSessions).toHaveBeenCalledWith('board-1', undefined));
    await waitFor(() => expect(screen.getByTestId('remaining-votes')).toHaveTextContent('3'));

    await act(async () => {
      screen.getByText('vote').click();
    });
    expect(mockCastVote).toHaveBeenCalledWith('board-1', 'vs-1', { targetRef: 'shape-1', voteValue: 1 });
    expect(screen.getByTestId('remaining-votes')).toHaveTextContent('2');

    await act(async () => {
      screen.getByText('remove').click();
    });
    expect(mockRemoveVote).toHaveBeenCalledWith('board-1', 'vs-1', 'shape-1');

    await act(async () => {
      screen.getByText('create').click();
    });
    expect(mockCreateSession).toHaveBeenCalledWith('board-1', expect.objectContaining({ scopeType: 'object', scopeRef: 'shape-1' }));
  });

  test('threads publication token into voting reads and uses participant token for anonymous publication voting', async () => {
    render(<HookProbe publicationToken="pub-token-1" authenticated={false} />);

    await waitFor(() => expect(mockListSessions).toHaveBeenCalledWith('board-1', { publicationToken: 'pub-token-1' }));
    await waitFor(() => expect(mockGetResults).toHaveBeenCalledWith('board-1', 'vs-1', { publicationToken: 'pub-token-1' }));
    await waitFor(() => expect(screen.getByTestId('participant-mode')).toHaveTextContent('publication-reader'));
    const initialToken = screen.getByTestId('participant-token').textContent || '';
    expect(initialToken).toContain('participant-');

    await act(async () => {
      screen.getByText('vote').click();
    });

    expect(mockCastVote).toHaveBeenCalledWith(
      'board-1',
      'vs-1',
      { targetRef: 'shape-1', voteValue: 1 },
      { publicationToken: 'pub-token-1', participantToken: initialToken }
    );

    await act(async () => {
      screen.getByText('remove').click();
    });
    expect(mockRemoveVote).toHaveBeenCalledWith('board-1', 'vs-1', 'shape-1', { publicationToken: 'pub-token-1', participantToken: initialToken });

    await act(async () => {
      screen.getByText('reset participant').click();
    });
    expect(screen.getByTestId('participant-token').textContent).not.toBe(initialToken);
  });
});
