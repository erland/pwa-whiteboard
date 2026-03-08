import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SharePanel } from '../SharePanel';

const authState = {
  configured: true,
  authenticated: true,
  accessToken: 'token',
  displayName: 'Alice',
  subject: 'alice',
  login: jest.fn(async () => {}),
  logout: jest.fn(async () => {}),
  refreshFromStorage: jest.fn(),
};

const invitesApi = {
  validateInvite: jest.fn(async () => ({ valid: true, permission: 'viewer', boardId: 'b-1' })),
  acceptInvite: jest.fn(async () => {}),
  createBoardInvite: jest.fn(async () => ({
    id: 'inv-1',
    boardId: 'b-1',
    permission: 'editor',
    expiresAt: '2027-03-08T12:30:00Z',
    maxUses: 3,
    uses: 0,
    revokedAt: null,
    createdAt: '2026-03-08T10:00:00Z',
    token: 'token-2',
  })),
  listBoardInvites: jest.fn(async () => ([
    {
      id: 'inv-1',
      boardId: 'b-1',
      permission: 'viewer',
      expiresAt: null,
      maxUses: null,
      uses: 1,
      revokedAt: null,
      createdAt: '2026-03-08T09:00:00Z',
    },
  ])),
  revokeBoardInvite: jest.fn(async () => {}),
};

const publicationsApi = {
  list: jest.fn(async () => []),
  create: jest.fn(async () => { throw new Error('not used'); }),
  revoke: jest.fn(async () => {}),
  rotateToken: jest.fn(async () => { throw new Error('not used'); }),
  resolve: jest.fn(async () => { throw new Error('not used'); }),
};

jest.mock('../../../auth/AuthContext', () => ({
  useAuth: () => authState,
}));

jest.mock('../../../api/invitesApi', () => ({
  validateInvite: (...args: any[]) => (invitesApi.validateInvite as any)(...args),
  acceptInvite: (...args: any[]) => (invitesApi.acceptInvite as any)(...args),
  createBoardInvite: (...args: any[]) => (invitesApi.createBoardInvite as any)(...args),
  listBoardInvites: (...args: any[]) => (invitesApi.listBoardInvites as any)(...args),
  revokeBoardInvite: (...args: any[]) => (invitesApi.revokeBoardInvite as any)(...args),
}));

jest.mock('../../../api/publicationsApi', () => ({
  createPublicationsApi: () => publicationsApi,
}));

describe('SharePanel invites', () => {
  beforeEach(() => {
    invitesApi.validateInvite.mockClear();
    invitesApi.acceptInvite.mockClear();
    invitesApi.createBoardInvite.mockClear();
    invitesApi.listBoardInvites.mockClear();
    invitesApi.revokeBoardInvite.mockClear();
    publicationsApi.list.mockClear();
  });

  test('lists existing invites, creates invite with admin options, and revokes active invites', async () => {
    render(
      <SharePanel
        boardId="b-1"
        boardName="Board A"
        features={{
          apiVersion: '1',
          wsProtocolVersion: '2',
          capabilities: [],
          supportsComments: false,
          supportsVoting: false,
          supportsPublications: false,
          supportsSharedTimer: false,
          supportsReactions: false,
        }}
      />
    );

    await waitFor(() => expect(invitesApi.listBoardInvites).toHaveBeenCalledWith('b-1'));
    expect(screen.getByText(/Viewer invite/i)).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('viewer'), { target: { value: 'editor' } });
    fireEvent.change(screen.getByLabelText(/Invite expiry/i), { target: { value: '2026-03-08T13:30' } });
    fireEvent.change(screen.getByLabelText(/Invite max uses/i), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /Create invite link/i }));

    await waitFor(() => expect(invitesApi.createBoardInvite).toHaveBeenCalled());
    expect(invitesApi.createBoardInvite).toHaveBeenCalledWith(expect.objectContaining({
      boardId: 'b-1',
      permission: 'editor',
      maxUses: 3,
    }));
    expect(await screen.findByLabelText(/Latest invite link/i)).toHaveValue('http://localhost/?invite=token-2');
    expect(screen.getAllByText(/Editor invite/i)[0]).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Revoke$/i }));
    await waitFor(() => expect(invitesApi.revokeBoardInvite).toHaveBeenCalledWith('b-1', 'inv-1'));
    await waitFor(() => expect(invitesApi.listBoardInvites).toHaveBeenCalledTimes(2));
  });
});
