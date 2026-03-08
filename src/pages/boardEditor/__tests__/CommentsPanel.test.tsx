import React, { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { CommentsPanel } from '../CommentsPanel';

const BASE_COMMENTS = [
  {
    id: 'c-1',
    boardId: 'b-1',
    parentCommentId: null,
    targetType: 'object' as const,
    targetRef: 'shape-1',
    authorUserId: 'alice',
    content: 'Please move this item.',
    state: 'active' as const,
    createdAt: '2026-03-08T10:00:00Z',
    updatedAt: '2026-03-08T10:00:00Z',
    resolvedAt: null,
    deletedAt: null,
  },
  {
    id: 'c-2',
    boardId: 'b-1',
    parentCommentId: 'c-1',
    targetType: 'comment' as const,
    targetRef: 'c-1',
    authorUserId: 'bob',
    content: 'Agreed.',
    state: 'active' as const,
    createdAt: '2026-03-08T10:05:00Z',
    updatedAt: '2026-03-08T10:05:00Z',
    resolvedAt: null,
    deletedAt: null,
  },
];

describe('CommentsPanel', () => {
  test('renders comment threads and posts new comments', async () => {
    const onCreateComment = jest.fn();

    render(
      <CommentsPanel
        enabled
        authenticated
        boardName="Board A"
        targetLabel="Selected object (shape-1)"
        comments={BASE_COMMENTS}
        isLoading={false}
        isMutating={false}
        error={null}
        activeCount={2}
        resolvedCount={0}
        onRefresh={jest.fn()}
        onCreateComment={onCreateComment}
        onReplyToComment={jest.fn()}
        onResolveComment={jest.fn()}
        onReopenComment={jest.fn()}
        onDeleteComment={jest.fn()}
      />
    );

    expect(screen.getByText('Please move this item.')).toBeInTheDocument();
    expect(screen.getByText('Agreed.')).toBeInTheDocument();
    expect(screen.getByText(/Selected object/)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Leave review feedback/i), { target: { value: 'Looks good overall' } });
    await act(async () => {
      fireEvent.click(screen.getByText('Post comment'));
    });

    expect(onCreateComment).toHaveBeenCalledWith('Looks good overall');
  });

  test('shows sign-in guidance when comments are supported but the user is signed out', () => {
    render(
      <CommentsPanel
        enabled
        authenticated={false}
        boardName="Board A"
        targetLabel="Board-level comment"
        comments={[]}
        isLoading={false}
        isMutating={false}
        error={null}
        activeCount={0}
        resolvedCount={0}
        onRefresh={jest.fn()}
        onCreateComment={jest.fn()}
        onReplyToComment={jest.fn()}
        onResolveComment={jest.fn()}
        onReopenComment={jest.fn()}
        onDeleteComment={jest.fn()}
      />
    );

    expect(screen.getByText(/Sign in to post, resolve, and manage comments/)).toBeInTheDocument();
  });
});
