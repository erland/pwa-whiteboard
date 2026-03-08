import React from 'react';
import { render, screen } from '@testing-library/react';
import { CapabilitySummary } from '../CapabilitySummary';
import { buildServerFeatureFlags } from '../../../domain/serverFeatures';

describe('CapabilitySummary', () => {
  test('shows enabled and disabled capability chips', () => {
    render(
      <CapabilitySummary
        features={buildServerFeatureFlags({ capabilities: ['comments', 'shared-timer'] })}
        isLoading={false}
        error={null}
      />
    );

    expect(screen.getByText(/Comments/)).toBeInTheDocument();
    expect(screen.getByText(/Shared timer/)).toBeInTheDocument();
    expect(screen.getByText(/Publication links/)).toBeInTheDocument();
  });
});
