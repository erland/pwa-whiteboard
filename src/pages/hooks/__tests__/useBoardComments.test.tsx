import React, { act } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useBoardComments } from '../useBoardComments';
import { createBoardAccessContext } from '../publicationSession';

const mockList = jest.fn();
const mockCreate = jest.fn();
const mockResolve = jest.fn();
const mockReopen = jest.fn();
const mockRemove = jest.fn();

jest.mock('../../../api/commentsApi', () => ({
  createCommentsApi: () => ({
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    resolve: (...args: unknown[]) => mockResolve(...args),
    reopen: (...args: unknown[]) => mockReopen(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
  }),
}));

function HookProbe(props: { selectedObjectIds: string[]; authenticated?: boolean; enabled?: boolean; publicationToken?: string | null; publicationAllowComments?: boolean }) {
  const state = useBoardComments({
    boardId: 'board-1',
    enabled: props.enabled ?? true,
    authenticated: props.authenticated ?? true,
    selectedObjectIds: props.selectedObjectIds,
    access: createBoardAccessContext({
      publicationSession: props.publicationToken
        ? {
            token: props.publicationToken,
            id: 'pub-1',
            boardId: 'board-1',
            targetType: 'board',
            snapshotVersion: null,
            allowComments: props.publicationAllowComments ?? false,
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
      <div data-testid="target-label">{state.target.label}</div>
      <div data-testid="comments-count">{state.comments.length}</div>
      <div data-testid="anchor-count">{state.objectAnchors.length}</div>
      <button onClick={() => void state.createComment('Review this')}>create</button>
      <button onClick={() => void state.replyToComment('comment-1', 'Reply here')}>reply</button>
    </div>
  );
}

describe('useBoardComments', () => {
  beforeEach(() => {
    mockList.mockReset();
    mockCreate.mockReset();
    mockResolve.mockReset();
    mockReopen.mockReset();
    mockRemove.mockReset();
    mockList.mockResolvedValue([]);
    mockCreate.mockResolvedValue({});
  });

  test('loads comments and targets the selected object when exactly one object is selected', async () => {
    mockList.mockResolvedValueOnce([
      {
        id: 'comment-1',
        boardId: 'board-1',
        parentCommentId: null,
        targetType: 'object',
        targetRef: 'shape-1',
        authorUserId: 'alice',
        content: 'Check this sticky',
        state: 'active',
        createdAt: '2026-03-08T10:00:00Z',
        updatedAt: '2026-03-08T10:00:00Z',
        resolvedAt: null,
        deletedAt: null,
      },
    ]);

    render(<HookProbe selectedObjectIds={['shape-1']} />);

    await waitFor(() => expect(screen.getByTestId('comments-count')).toHaveTextContent('1'));
    expect(screen.getByTestId('target-label')).toHaveTextContent('Selected object (shape-1)');
  });

  test('creates board-level and reply comments through the typed comments API', async () => {
    render(<HookProbe selectedObjectIds={[]} />);

    await waitFor(() => expect(mockList).toHaveBeenCalledWith('board-1'));

    await act(async () => {
      screen.getByText('create').click();
    });
    expect(mockCreate).toHaveBeenCalledWith('board-1', {
      targetType: 'board',
      targetRef: null,
      content: 'Review this',
    });

    await act(async () => {
      screen.getByText('reply').click();
    });
    expect(mockCreate).toHaveBeenCalledWith('board-1', {
      targetType: 'comment',
      targetRef: 'comment-1',
      parentCommentId: 'comment-1',
      content: 'Reply here',
    });
  });
});


test('threads publication token into comment listing for publication sessions', async () => {
  render(<HookProbe selectedObjectIds={[]} authenticated={false} publicationToken="pub-token-1" publicationAllowComments={true} />);

  await waitFor(() => expect(mockList).toHaveBeenCalledWith('board-1', { publicationToken: 'pub-token-1' }));

  await act(async () => {
    screen.getByText('create').click();
  });

  expect(mockCreate).not.toHaveBeenCalled();
});


test('does not fetch comments for publications that disallow comment access', async () => {
  render(<HookProbe selectedObjectIds={[]} authenticated={false} publicationToken="pub-token-2" publicationAllowComments={false} />);

  await waitFor(() => expect(screen.getByTestId('comments-count')).toHaveTextContent('0'));
  expect(mockList).not.toHaveBeenCalled();
});

test('allows authenticated comment creation in publication sessions when publication comments are enabled', async () => {
  render(<HookProbe selectedObjectIds={[]} authenticated={true} publicationToken="pub-token-3" publicationAllowComments={true} />);

  await waitFor(() => expect(mockList).toHaveBeenCalledWith('board-1', { publicationToken: 'pub-token-3' }));

  await act(async () => {
    screen.getByText('create').click();
  });

  expect(mockCreate).toHaveBeenCalledWith('board-1', {
    targetType: 'board',
    targetRef: null,
    content: 'Review this',
  });
});


test('builds object-level comment anchors for object review markers', async () => {
  mockList.mockResolvedValueOnce([
    {
      id: 'comment-1',
      boardId: 'board-1',
      parentCommentId: null,
      targetType: 'object',
      targetRef: 'shape-1',
      authorUserId: 'alice',
      content: 'Needs review',
      state: 'active',
      createdAt: '2026-03-08T10:00:00Z',
      updatedAt: '2026-03-08T10:00:00Z',
      resolvedAt: null,
      deletedAt: null,
    },
    {
      id: 'comment-2',
      boardId: 'board-1',
      parentCommentId: 'comment-1',
      targetType: 'comment',
      targetRef: 'comment-1',
      authorUserId: 'bob',
      content: 'Following up',
      state: 'active',
      createdAt: '2026-03-08T10:05:00Z',
      updatedAt: '2026-03-08T10:05:00Z',
      resolvedAt: null,
      deletedAt: null,
    },
  ]);

  render(<HookProbe selectedObjectIds={['shape-1']} />);

  await waitFor(() => expect(screen.getByTestId('anchor-count')).toHaveTextContent('1'));
});
