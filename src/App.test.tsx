import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

describe('App', () => {
  it('renders header and boards link', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(screen.getByText(/PWA Whiteboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Boards/i)).toBeInTheDocument();
  });
});
