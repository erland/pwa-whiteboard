import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ParticipantActivityStrip } from '../ParticipantActivityStrip';

describe('ParticipantActivityStrip', () => {
  test('shows presenter and follow controls', () => {
    const onFollowUser = jest.fn();
    const onStartPresenting = jest.fn();
    render(
      <ParticipantActivityStrip
        users={[
          { userId: 'me', displayName: 'Me', role: 'editor' },
          { userId: 'u-2', displayName: 'Alice', role: 'editor' },
        ]}
        presenceByUserId={{
          'u-2': { viewport: { panX: 0, panY: 0, zoom: 1 }, selectionIds: ['x'] },
        }}
        selfUserId="me"
        presenterUserId="u-2"
        followingUserId={null}
        onFollowUser={onFollowUser}
        onStartPresenting={onStartPresenting}
      />
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('presenting')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
    expect(onFollowUser).toHaveBeenCalledWith('u-2');

    fireEvent.click(screen.getByRole('button', { name: 'Present' }));
    expect(onStartPresenting).toHaveBeenCalled();
  });
});
