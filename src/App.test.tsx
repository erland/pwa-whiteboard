import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { WhiteboardProvider } from './whiteboard/WhiteboardStore';

const authState: {
  configured: boolean;
  authenticated: boolean;
  accessToken: string | null;
  displayName: string | null;
  subject: string | null;
  login: jest.Mock<Promise<void>, []>;
  logout: jest.Mock<Promise<void>, []>;
  refreshFromStorage: jest.Mock<void, []>;
} = {
  configured: false,
  authenticated: false,
  accessToken: null,
  displayName: null,
  subject: null,
  login: jest.fn(async () => {}),
  logout: jest.fn(async () => {}),
  refreshFromStorage: jest.fn(),
};

jest.mock('./auth/AuthContext', () => ({
  useAuth: () => authState,
}));

describe('App', () => {
  beforeEach(() => {
    authState.configured = false;
    authState.authenticated = false;
    authState.accessToken = null;
    authState.displayName = null;
    authState.subject = null;
    authState.login.mockClear();
    authState.logout.mockClear();
    authState.refreshFromStorage.mockClear();
  });

  it('renders header and board list heading', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <WhiteboardProvider>
          <App />
        </WhiteboardProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/PWA Whiteboard/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Boards/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();

    const heading = await screen.findByRole('heading', { name: /Your Boards/i });
    expect(heading).toBeInTheDocument();
  });

  it('shows sign-in control only when OIDC is configured', async () => {
    authState.configured = true;
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/']}>
        <WhiteboardProvider>
          <App />
        </WhiteboardProvider>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: /Your Boards/i });

    const signInButton = screen.getByRole('button', { name: /sign in/i });
    expect(signInButton).toBeInTheDocument();

    await user.click(signInButton);
    await waitFor(() => expect(authState.login).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled());
  });

  it('shows sign-out control for authenticated users when OIDC is configured', async () => {
    authState.configured = true;
    authState.authenticated = true;
    const user = userEvent.setup();
    authState.accessToken = 'token';
    authState.displayName = 'Erland Lindmark';
    authState.subject = 'user-123';

    render(
      <MemoryRouter initialEntries={['/']}>
        <WhiteboardProvider>
          <App />
        </WhiteboardProvider>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: /Your Boards/i });

    expect(screen.getByText('Erland Lindmark')).toBeInTheDocument();
    const signOutButton = screen.getByRole('button', { name: /sign out/i });
    await user.click(signOutButton);
    await waitFor(() => expect(authState.logout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: /sign out/i })).toBeEnabled());
  });
});
