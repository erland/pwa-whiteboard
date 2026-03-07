import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { BoardListPage } from "../BoardListPage";

const mockUseAuth = jest.fn();
const mockGetLocalBoardsRepository = jest.fn();
const mockGetRemoteBoardsRepository = jest.fn();
const mockGetInvitedBoardsRepository = jest.fn();
const mockNavigate = jest.fn();

jest.mock("../../auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../../config/server", () => ({
  isWhiteboardServerConfigured: () => true,
}));

jest.mock("../../infrastructure/localStorageBoardsRepository", () => ({
  getBoardsRepository: jest.fn(),
  getLocalBoardsRepository: () => mockGetLocalBoardsRepository(),
  getRemoteBoardsRepository: () => mockGetRemoteBoardsRepository(),
}));

jest.mock("../../infrastructure/localStorageInvitedBoardsRepository", () => ({
  getInvitedBoardsRepository: () => mockGetInvitedBoardsRepository(),
}));

jest.mock("../../infrastructure/localStorageWhiteboardRepository", () => ({
  getWhiteboardRepository: () => ({
    loadBoard: jest.fn(),
    saveBoard: jest.fn(),
  }),
}));

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("BoardListPage server workflow verification", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockGetLocalBoardsRepository.mockReset();
    mockGetRemoteBoardsRepository.mockReset();
    mockGetInvitedBoardsRepository.mockReset();
    mockNavigate.mockReset();
  });

  test("server-backed authenticated workflow keeps local drafts visible without uploading them", async () => {
    mockUseAuth.mockReturnValue({
      configured: true,
      authenticated: true,
      login: jest.fn(),
    });
    mockGetLocalBoardsRepository.mockReturnValue({
      listBoards: jest.fn().mockResolvedValue([
        {
          id: "local-keep-1",
          name: "Offline draft",
          boardType: "advanced",
          updatedAt: "2026-03-07T11:30:00Z",
          createdAt: "2026-03-07T11:30:00Z",
        },
      ]),
      createBoard: jest.fn(),
      renameBoard: jest.fn(),
      deleteBoard: jest.fn(),
    });
    mockGetRemoteBoardsRepository.mockReturnValue({
      listBoards: jest.fn().mockResolvedValue([
        {
          id: "b-1",
          name: "Server board",
          boardType: "advanced",
          updatedAt: "2026-03-07T12:00:00Z",
          createdAt: "2026-03-07T12:00:00Z",
        },
      ]),
      createBoard: jest.fn(),
      renameBoard: jest.fn(),
      deleteBoard: jest.fn(),
    });
    mockGetInvitedBoardsRepository.mockReturnValue({
      listInvitedBoards: jest.fn().mockResolvedValue([
        {
          boardId: "invite-1",
          title: "Shared board",
          inviteToken: "token-1",
          permission: "editor",
          expiresAt: null,
          lastOpenedAt: "2026-03-07T12:05:00Z",
        },
      ]),
    });

    render(
      <MemoryRouter>
        <BoardListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Server board")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "My boards" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Invited boards" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Local drafts" })).toBeInTheDocument();
    expect(screen.getByText("Shared board")).toBeInTheDocument();
    expect(screen.getByText("Offline draft")).toBeInTheDocument();
    expect(screen.getByText("Local drafts stay in this browser and are not uploaded to the server automatically.")).toBeInTheDocument();
  });

  test("server-backed unauthenticated workflow shows invited boards when present", async () => {
    const login = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      configured: true,
      authenticated: false,
      login,
    });
    mockGetLocalBoardsRepository.mockReturnValue({
      listBoards: jest.fn().mockResolvedValue([
        {
          id: "local-hidden-1",
          name: "Hidden local draft",
          boardType: "advanced",
          updatedAt: "2026-03-07T12:09:00Z",
          createdAt: "2026-03-07T12:09:00Z",
        },
      ]),
      createBoard: jest.fn(),
      renameBoard: jest.fn(),
      deleteBoard: jest.fn(),
    });
    mockGetInvitedBoardsRepository.mockReturnValue({
      listInvitedBoards: jest.fn().mockResolvedValue([
        {
          boardId: "invite-2",
          title: "Guest board",
          inviteToken: "token-2",
          permission: "viewer",
          expiresAt: null,
          lastOpenedAt: "2026-03-07T12:10:00Z",
        },
      ]),
    });

    render(
      <MemoryRouter>
        <BoardListPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Guest board")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Invited boards" })).toBeInTheDocument();
    expect(screen.queryByText("Sign in is required to load your boards.")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Local drafts" })).not.toBeInTheDocument();
    expect(mockGetRemoteBoardsRepository).not.toHaveBeenCalled();

    const maybeSignInButton = screen.queryByText("Sign in");
    if (maybeSignInButton) {
      fireEvent.click(maybeSignInButton);
    }
    expect(login).toHaveBeenCalledTimes(0);
  });

  test("server-backed unauthenticated workflow keeps sign-in action when no invited boards exist", async () => {
    const login = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      configured: true,
      authenticated: false,
      login,
    });
    mockGetLocalBoardsRepository.mockReturnValue({
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

    expect(await screen.findByText("Sign in is required to load your boards.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Sign in"));
    expect(login).toHaveBeenCalledTimes(1);
    expect(mockGetRemoteBoardsRepository).not.toHaveBeenCalled();
  });
});
