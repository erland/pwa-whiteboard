import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useBoardCapabilities } from '../useBoardCapabilities';

const mockGetServerCapabilities = jest.fn();

jest.mock('../../../api/capabilitiesApi', () => ({
  getServerCapabilities: () => mockGetServerCapabilities(),
}));

function TestProbe({ enabled }: { enabled: boolean }) {
  const state = useBoardCapabilities({ enabled });
  return (
    <div>
      <div data-testid="loading">{String(state.isLoading)}</div>
      <div data-testid="error">{state.error ?? ''}</div>
      <div data-testid="comments">{String(state.features.supportsComments)}</div>
      <div data-testid="publications">{String(state.features.supportsPublications)}</div>
    </div>
  );
}

describe('useBoardCapabilities', () => {
  beforeEach(() => {
    mockGetServerCapabilities.mockReset();
  });

  test('loads server capabilities into feature flags', async () => {
    mockGetServerCapabilities.mockResolvedValue({
      apiVersion: '1',
      wsProtocolVersion: '2',
      capabilities: ['comments', 'publications'],
    });

    render(<TestProbe enabled />);

    await waitFor(() => expect(screen.getByTestId('comments')).toHaveTextContent('true'));
    expect(screen.getByTestId('publications')).toHaveTextContent('true');
    expect(screen.getByTestId('error')).toHaveTextContent('');
  });

  test('resets feature flags when disabled', async () => {
    render(<TestProbe enabled={false} />);

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(mockGetServerCapabilities).not.toHaveBeenCalled();
    expect(screen.getByTestId('comments')).toHaveTextContent('false');
    expect(screen.getByTestId('publications')).toHaveTextContent('false');
  });
});
