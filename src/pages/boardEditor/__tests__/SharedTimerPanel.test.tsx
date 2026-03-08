import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SharedTimerPanel } from '../SharedTimerPanel';

describe('SharedTimerPanel', () => {
  test('renders timer readout and start action', async () => {
    const user = userEvent.setup();
    const onStart = jest.fn();
    render(
      <SharedTimerPanel
        enabled
        connected
        canControl
        timer={null}
        displayRemainingMs={0}
        formattedRemaining="00:00"
        isMutating={false}
        error={null}
        onClearError={() => {}}
        onStart={onStart}
        onPause={() => {}}
        onResume={() => {}}
        onReset={() => {}}
        onCancelTimer={() => {}}
        onComplete={() => {}}
      />
    );

    expect(screen.getByText('Shared timer')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(onStart).toHaveBeenCalledWith({ durationMinutes: 5, label: null });
  });
});
