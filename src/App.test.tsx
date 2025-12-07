import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { WhiteboardProvider } from './whiteboard/WhiteboardStore';

describe('App', () => {
  it('renders header and board list heading', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <WhiteboardProvider>
          <App />
        </WhiteboardProvider>
      </MemoryRouter>
    );

    // These are static and can be checked synchronously
    expect(screen.getByText(/PWA Whiteboard/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Boards/i })).toBeInTheDocument();

    // This waits for the async effect in BoardListPage to finish and
    // wraps the state updates in act(), removing the warning.
    const heading = await screen.findByRole('heading', { name: /Your Boards/i });
    expect(heading).toBeInTheDocument();
  });
});