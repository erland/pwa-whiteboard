import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { BoardListPage } from '../BoardListPage';

const mockUseAuth = jest.fn();
const mockGetLocalBoardsRepository = jest.fn();
const mockGetRemoteBoardsRepository = jest.fn();
const mockGetInvitedBoardsRepository = jest.fn();
const mockNavigate = jest.fn();
const mockIsWhiteboardServerConfigured = jest.fn();

jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../config/server', () => ({
  isWhiteboardServerConfigured: () => mockIsWhiteboardServerConfigured(),
}));

jest.mock('../../infrastructure/localStorageBoardsRepository', () => ({
  getBoardsRepository: jest.fn(),
  getLocalBoardsRepository: () => mockGetLocalBoardsRepository(),
  getRemoteBoardsRepository: () => mockGetRemoteBoardsRepository(),
}));

jest.mock('../../infrastructure/localStorageInvitedBoardsRepository', () => ({
  getInvitedBoardsRepository: () => mockGetInvitedBoardsRepository(),
}));

jest.mock('../../infrastructure/localStorageWhiteboardRepository', () => ({
  getWhiteboardRepository: () => ({
    loadBoard: jest.fn(),
    saveBoard: jest.fn(),
  }),
}));

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('BoardListPage section rendering', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockGetLocalBoardsRepository.mockReset();
    mockGetRemoteBoardsRepository.mockReset();
    mockGetInvitedBoardsRepository.mockReset();
    mockNavigate.mockReset();
    mockIsWhiteboardServerConfigured.mockReset();
  });

  test('renders a Local boards section when server is not configured', async () => {
    mockIsWhiteboardServerConfigured.mockReturnValue(false);
    mockUseAuth.mockReturnValue({
      configured: false,
      authenticated: false,
      login: jest.fn(),
    });
    mockGetLocalBoardsRepository.mockReturnValue({
      listBoards: jest.fn().mockResolvedValue([
        {
          id: 'local-1',
          name: 'Local board',
          boardType: 'advanced',
          createdAt: '2026-03-07T12:00:00Z',
          updatedAt: '2026-03-07T12:00:00Z',
        },
      ]),
      createBoard: jest.fn(),
      renameBoard: jest.fn(),
      deleteBoard: jest.fn(),
    });
    mockGetInvitedBoardsRepository.mockReturnValue({
      listInvitedBoards: jest.fn().mockResolvedValue([]),
    });

    render(
      <MemoryRouter>
        <BoardListPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Local boards' })).toBeInTheDocument();
    expect(screen.getByText('Local board')).toBeInTheDocument();
  });

  test('renders My boards and Invited boards sections in server mode', async () => {
    mockIsWhiteboardServerConfigured.mockReturnValue(true);
    mockUseAuth.mockReturnValue({
      configured: true,
      authenticated: true,
      login: jest.fn(),
    });
    mockGetLocalBoardsRepository.mockReturnValue({
      listBoards: jest.fn().mockResolvedValue([]),
      createBoard: jest.fn(),
      renameBoard: jest.fn(),
      deleteBoard: jest.fn(),
    });
    mockGetLocalBoardsRepository.mockReturnValue({
      listBoards: jest.fn().mockResolvedValue([]),
      createBoard: jest.fn(),
      renameBoard: jest.fn(),
      deleteBoard: jest.fn(),
    });
    mockGetRemoteBoardsRepository.mockReturnValue({
      listBoards: jest.fn().mockResolvedValue([
        {
          id: 'remote-1',
          name: 'Remote board',
          boardType: 'advanced',
          createdAt: '2026-03-07T12:00:00Z',
          updatedAt: '2026-03-07T12:00:00Z',
        },
      ]),
      createBoard: jest.fn(),
      renameBoard: jest.fn(),
      deleteBoard: jest.fn(),
    });
    mockGetInvitedBoardsRepository.mockReturnValue({
      listInvitedBoards: jest.fn().mockResolvedValue([
        {
          boardId: 'invite-1',
          title: 'Shared board',
          inviteToken: 'token-1',
          permission: 'editor',
          expiresAt: null,
          lastOpenedAt: '2026-03-07T12:05:00Z',
        },
      ]),
    });

    render(
      <MemoryRouter>
        <BoardListPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'My boards' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Invited boards' })).toBeInTheDocument();
    expect(screen.getByText('Remote board')).toBeInTheDocument();
    expect(screen.getByText('Shared board')).toBeInTheDocument();
  });
});


  test('renders Local drafts with a note in authenticated server mode when browser-local boards exist', async () => {
    mockIsWhiteboardServerConfigured.mockReturnValue(true);
    mockUseAuth.mockReturnValue({
      configured: true,
      authenticated: true,
      login: jest.fn(),
    });
    mockGetLocalBoardsRepository.mockReturnValue({
      listBoards: jest.fn().mockResolvedValue([
        {
          id: 'local-draft-2',
          name: 'Browser draft',
          boardType: 'advanced',
          createdAt: '2026-03-07T11:50:00Z',
          updatedAt: '2026-03-07T11:55:00Z',
        },
      ]),
      createBoard: jest.fn(),
      renameBoard: jest.fn(),
      deleteBoard: jest.fn(),
    });
    mockGetRemoteBoardsRepository.mockReturnValue({
      listBoards: jest.fn().mockResolvedValue([]),
      createBoard: jest.fn(),
      renameBoard: jest.fn(),
      deleteBoard: jest.fn(),
    });
    mockGetInvitedBoardsRepository.mockReturnValue({
      listInvitedBoards: jest.fn().mockResolvedValue([]),
    });

    render(
      <MemoryRouter>
        <BoardListPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Local drafts' })).toBeInTheDocument();
    expect(screen.getByText('Browser draft')).toBeInTheDocument();
    expect(
      screen.getByText('Local drafts stay in this browser and are not uploaded to the server automatically.')
    ).toBeInTheDocument();
  });

  test('hides rename, duplicate, and delete actions for invited boards while keeping them for owned boards', async () => {
    mockIsWhiteboardServerConfigured.mockReturnValue(true);
    mockUseAuth.mockReturnValue({
      configured: true,
      authenticated: true,
      login: jest.fn(),
    });
    mockGetRemoteBoardsRepository.mockReturnValue({
      listBoards: jest.fn().mockResolvedValue([
        {
          id: 'remote-2',
          name: 'Remote board',
          boardType: 'advanced',
          createdAt: '2026-03-07T12:00:00Z',
          updatedAt: '2026-03-07T12:00:00Z',
        },
      ]),
      createBoard: jest.fn(),
      renameBoard: jest.fn(),
      deleteBoard: jest.fn(),
    });
    mockGetInvitedBoardsRepository.mockReturnValue({
      listInvitedBoards: jest.fn().mockResolvedValue([
        {
          boardId: 'invite-2',
          title: 'Shared board',
          inviteToken: 'token-2',
          permission: 'viewer',
          expiresAt: null,
          lastOpenedAt: '2026-03-07T12:05:00Z',
        },
      ]),
    });

    const { container } = render(
      <MemoryRouter>
        <BoardListPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'My boards' })).toBeInTheDocument();

    const sections = container.querySelectorAll('.board-list-section');
    const myBoardsSection = sections[0];
    const invitedSection = sections[1];

    expect(myBoardsSection).toHaveTextContent('Duplicate');
    expect(myBoardsSection).toHaveTextContent('Rename');
    expect(myBoardsSection).toHaveTextContent('Delete');

    expect(invitedSection).not.toHaveTextContent('Duplicate');
    expect(invitedSection).not.toHaveTextContent('Rename');
    expect(invitedSection).not.toHaveTextContent('Delete');
    expect(invitedSection).toHaveTextContent('Shared board');
  });
