import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { WhiteboardProvider } from './whiteboard/WhiteboardStore';

describe('App', () => {
  it('renders header and boards link', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <WhiteboardProvider>
          <App />
        </WhiteboardProvider>
      </MemoryRouter>
    );

    // App title in the header
    expect(screen.getByText(/PWA Whiteboard/i)).toBeInTheDocument();

    // The navigation link with label "Boards"
    expect(
      screen.getByRole('link', { name: /Boards/i })
    ).toBeInTheDocument();

    // Optional: assert the page heading to be sure we’re on the board list page
    expect(
      screen.getByRole('heading', { name: /Your Boards/i })
    ).toBeInTheDocument();
  });
});