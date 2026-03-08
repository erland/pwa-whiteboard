import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FacilitationDialog } from '../FacilitationDialog';

function buildProps(overrides: Record<string, unknown> = {}) {
  return {
    isOpen: true,
    boardName: 'Demo board',
    activeTab: 'overview' as const,
    onChangeTab: jest.fn(),
    commentsEnabled: true,
    commentsAuthenticated: true,
    commentsTargetLabel: 'Selected object',
    comments: [],
    commentsLoading: false,
    commentsMutating: false,
    commentsError: null,
    commentsActiveCount: 2,
    commentsResolvedCount: 1,
    onRefreshComments: jest.fn(),
    onCreateComment: jest.fn(),
    onReplyToComment: jest.fn(),
    onResolveComment: jest.fn(),
    onReopenComment: jest.fn(),
    onDeleteComment: jest.fn(),
    votingEnabled: true,
    votingAuthenticated: true,
    votingSessions: [],
    votingSelectedSessionId: null,
    votingResults: null,
    votingAvailableTargets: [],
    votingSelectedTargets: [],
    votingLocalVotesByTarget: {},
    votingRemainingVotes: null,
    votingLoading: false,
    votingMutating: false,
    votingError: null,
    onRefreshVoting: jest.fn(),
    onSelectVotingSession: jest.fn(),
    onCreateVotingSession: jest.fn(),
    onOpenVotingSession: jest.fn(),
    onCloseVotingSession: jest.fn(),
    onRevealVotingSession: jest.fn(),
    onCancelVotingSession: jest.fn(),
    onCastVote: jest.fn(),
    onRemoveVote: jest.fn(),
    sharedTimerEnabled: true,
    sharedTimerConnected: true,
    sharedTimerCanControl: true,
    sharedTimer: null,
    sharedTimerDisplay: '05:00',
    sharedTimerRemainingMs: 300000,
    sharedTimerMutating: false,
    sharedTimerError: null,
    onClearSharedTimerError: jest.fn(),
    onStartSharedTimer: jest.fn(),
    onPauseSharedTimer: jest.fn(),
    onResumeSharedTimer: jest.fn(),
    onResetSharedTimer: jest.fn(),
    onCancelSharedTimer: jest.fn(),
    onCompleteSharedTimer: jest.fn(),
    reactionsEnabled: true,
    onCancel: jest.fn(),
    ...overrides,
  };
}

describe('FacilitationDialog', () => {
  it('renders overview cards and switches tabs from overview shortcuts', () => {
    const props = buildProps();
    render(<FacilitationDialog {...props} />);

    expect(screen.getByText('Facilitation')).toBeInTheDocument();
    expect(screen.getByText(/2 active/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Open comments/i }));
    expect(props.onChangeTab).toHaveBeenCalledWith('comments');
  });

  it('renders the selected panel tab', () => {
    render(<FacilitationDialog {...buildProps({ activeTab: 'comments' })} />);
    expect(screen.getByRole('button', { name: /Post comment/i })).toBeInTheDocument();
  });
});
