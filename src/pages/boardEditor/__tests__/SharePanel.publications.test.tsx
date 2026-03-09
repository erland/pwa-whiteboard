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
  createBoardInvite: jest.fn(async () => { throw new Error('not used'); }),
  listBoardInvites: jest.fn(async () => []),
  revokeBoardInvite: jest.fn(async () => {}),
};

const publicationsApi = {
  list: jest.fn(async () => []),
  create: jest.fn(async () => ({
    publication: {
      id: 'pub-1',
      boardId: 'b-1',
      snapshotVersion: 7,
      targetType: 'snapshot',
      state: 'active',
      createdByUserId: 'alice',
      allowComments: true,
      createdAt: '2026-03-08T10:00:00Z',
      updatedAt: '2026-03-08T10:00:00Z',
      expiresAt: null,
      revokedAt: null,
    },
    token: 'tok-1',
  })),
  revoke: jest.fn(async () => {}),
  rotateToken: jest.fn(async () => ({
    publication: {
      id: 'pub-1',
      boardId: 'b-1',
      snapshotVersion: 7,
      targetType: 'snapshot',
      state: 'active',
      createdByUserId: 'alice',
      allowComments: true,
      createdAt: '2026-03-08T10:00:00Z',
      updatedAt: '2026-03-08T10:05:00Z',
      expiresAt: null,
      revokedAt: null,
    },
    token: 'tok-2',
  })),
  resolve: jest.fn(async () => ({
    id: 'pub-1',
    boardId: 'b-1',
    snapshotVersion: 7,
    targetType: 'snapshot',
    state: 'active',
    createdByUserId: 'alice',
    allowComments: true,
    createdAt: '2026-03-08T10:00:00Z',
    updatedAt: '2026-03-08T10:05:00Z',
    expiresAt: null,
    revokedAt: null,
  })),
};

jest.mock('../../../auth/AuthContext', () => ({
  useAuth: () => authState,
}));

jest.mock('../../../api/publicationsApi', () => ({
  createPublicationsApi: () => publicationsApi,
}));

jest.mock('../../../api/invitesApi', () => ({
  validateInvite: (...args: any[]) => (invitesApi.validateInvite as any)(...args),
  acceptInvite: (...args: any[]) => (invitesApi.acceptInvite as any)(...args),
  createBoardInvite: (...args: any[]) => (invitesApi.createBoardInvite as any)(...args),
  listBoardInvites: (...args: any[]) => (invitesApi.listBoardInvites as any)(...args),
  revokeBoardInvite: (...args: any[]) => (invitesApi.revokeBoardInvite as any)(...args),
}));

describe('SharePanel publications', () => {
  beforeEach(() => {
    publicationsApi.list.mockClear();
    publicationsApi.create.mockClear();
    publicationsApi.revoke.mockClear();
    publicationsApi.rotateToken.mockClear();
    publicationsApi.resolve.mockClear();
  });

  test('creates publication links when server capabilities advertise publications', async () => {
    invitesApi.listBoardInvites.mockClear();
    render(
      <SharePanel
        boardId="b-1"
        boardName="Board A"
        features={{
          apiVersion: '1',
          wsProtocolVersion: '2',
          capabilities: ['publications'],
          supportsComments: false,
          supportsVoting: false,
          supportsPublications: true,
          supportsSharedTimer: false,
          supportsReactions: false,
        }}
      />
    );

    await waitFor(() => expect(publicationsApi.list).toHaveBeenCalledWith('b-1'));

    fireEvent.click(screen.getByRole('button', { name: /New publication link/i }));
    fireEvent.change(screen.getByLabelText(/Publication target/i), { target: { value: 'snapshot' } });
    fireEvent.change(screen.getByLabelText(/Snapshot version/i), { target: { value: '7' } });
    fireEvent.click(screen.getByLabelText(/Allow comments for published readers/i));
    fireEvent.click(screen.getByRole('button', { name: /Create publication link/i }));

    await waitFor(() => expect(publicationsApi.create).toHaveBeenCalled());
    expect(publicationsApi.create).toHaveBeenCalledWith('b-1', expect.objectContaining({
      targetType: 'snapshot',
      snapshotVersion: 7,
      allowComments: true,
    }));

    expect(await screen.findByLabelText(/Latest publication link/i)).toHaveValue('http://localhost/?publication=tok-1');
    expect(screen.getByText(/Snapshot v7/)).toBeInTheDocument();
  });
});
