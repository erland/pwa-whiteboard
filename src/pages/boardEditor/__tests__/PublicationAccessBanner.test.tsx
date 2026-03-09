import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { PublicationAccessBanner } from '../PublicationAccessBanner';

const basePublication = {
  token: 'pub-token-1',
  id: 'pub-1',
  boardId: 'b-1',
  targetType: 'snapshot' as const,
  snapshotVersion: 7,
  allowComments: true,
  state: 'active',
  createdAt: '2026-03-08T10:00:00Z',
  updatedAt: '2026-03-08T10:00:00Z',
  expiresAt: null,
};

describe('PublicationAccessBanner', () => {
  it('shows publication metadata and comment actions for signed-out readers', () => {
    const onOpenComments = jest.fn();
    const onSignIn = jest.fn();

    render(
      <PublicationAccessBanner
        publicationSession={basePublication}
        commentsFeatureEnabled
        commentsAuthenticated={false}
        onOpenComments={onOpenComments}
        onSignIn={onSignIn}
      />
    );

    expect(screen.getByText('Published board')).toBeInTheDocument();
    expect(screen.getByText(/Snapshot v7/i)).toBeInTheDocument();
    expect(screen.getByText(/Comments are available after sign-in/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Open comments/i }));
    expect(onOpenComments).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Sign in for board access/i }));
    expect(onSignIn).toHaveBeenCalled();
  });

  it('shows a view-only message when publication comments are disabled', () => {
    render(
      <PublicationAccessBanner
        publicationSession={{ ...basePublication, allowComments: false, targetType: 'board', snapshotVersion: null }}
        commentsFeatureEnabled
        commentsAuthenticated={false}
      />
    );

    expect(screen.getByText(/Live board/i)).toBeInTheDocument();
    expect(screen.getByText(/view-only/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open comments/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sign in for board access/i })).not.toBeInTheDocument();
  });
});
