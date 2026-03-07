import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { BoardListPage } from '../BoardListPage';

const mockUseAuth = jest.fn();
const mockGetBoardsRepository = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../config/server', () => ({
  isWhiteboardServerConfigured: () => true,
}));

jest.mock('../../infrastructure/localStorageBoardsRepository', () => ({
  getBoardsRepository: () => mockGetBoardsRepository(),
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

describe('BoardListPage server workflow verification', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockGetBoardsRepository.mockReset();
    mockNavigate.mockReset();
  });

  test('server-backed authenticated workflow loads and shows boards from the repository', async () => {
    mockUseAuth.mockReturnValue({
      configured: true,
      authenticated: true,
      login: jest.fn(),
    });
    mockGetBoardsRepository.mockReturnValue({
      listBoards: jest.fn().mockResolvedValue([
        {
          id: 'b-1',
          name: 'Server board',
          boardType: 'advanced',
          updatedAt: '2026-03-07T12:00:00Z',
          createdAt: '2026-03-07T12:00:00Z',
        },
      ]),
      createBoard: jest.fn(),
      renameBoard: jest.fn(),
      deleteBoard: jest.fn(),
    });

    render(
      <MemoryRouter>
        <BoardListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Server board')).toBeInTheDocument());
  });

  test('server-backed unauthenticated workflow shows a sign-in action and uses auth.login', async () => {
    const login = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      configured: true,
      authenticated: false,
      login,
    });

    render(
      <MemoryRouter>
        <BoardListPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Sign in is required to load your boards.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Sign in'));
    expect(login).toHaveBeenCalledTimes(1);
    expect(mockGetBoardsRepository).not.toHaveBeenCalled();
  });
});
