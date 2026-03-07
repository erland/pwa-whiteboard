import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useBoardListPageModel } from "../useBoardListPageModel";

const mockIsWhiteboardServerConfigured = jest.fn();
const mockGetLocalBoardsRepository = jest.fn();
const mockGetRemoteBoardsRepository = jest.fn();
const mockGetInvitedBoardsRepository = jest.fn();

jest.mock("../../../config/server", () => ({
  isWhiteboardServerConfigured: () => mockIsWhiteboardServerConfigured(),
}));

jest.mock("../../../infrastructure/localStorageBoardsRepository", () => ({
  getBoardsRepository: jest.fn(),
  getLocalBoardsRepository: () => mockGetLocalBoardsRepository(),
  getRemoteBoardsRepository: () => mockGetRemoteBoardsRepository(),
}));

jest.mock("../../../infrastructure/localStorageInvitedBoardsRepository", () => ({
  getInvitedBoardsRepository: () => mockGetInvitedBoardsRepository(),
}));

jest.mock("../../../infrastructure/localStorageWhiteboardRepository", () => ({
  getWhiteboardRepository: () => ({
    loadBoard: jest.fn(),
    saveBoard: jest.fn(),
  }),
}));

function ModelProbe({
  auth,
}: {
  auth: { configured: boolean; authenticated: boolean; login: () => Promise<void> };
}) {
  const model = useBoardListPageModel(auth, () => undefined as never);

  return (
    <>
      <div data-testid="boards">{model.boards.map((board) => board.id).join(",")}</div>
      <div data-testid="items">
        {model.boardItems
          .map(
            (item) =>
              `${item.source}:${item.board.id}:${item.actions.canDuplicate ? "dup" : "nodup"}:${item.actions.canRename ? "ren" : "noren"}:${item.actions.canDelete ? "del" : "nodel"}`
          )
          .join(",")}
      </div>
      <div data-testid="sections">
        {model.boardSections.map((section) => `${section.id}:${section.title}:${section.items.length}`).join("|")}
      </div>
      <div data-testid="load-state">{model.loadState}</div>
      <div data-testid="error">{model.error ?? ""}</div>
      <div data-testid="needs-auth">{String(model.needsAuth)}</div>
    </>
  );
}

describe("useBoardListPageModel board source view model", () => {
  beforeEach(() => {
    mockIsWhiteboardServerConfigured.mockReset();
    mockGetLocalBoardsRepository.mockReset();
    mockGetRemoteBoardsRepository.mockReset();
    mockGetInvitedBoardsRepository.mockReset();
  });

  test("tags loaded boards as local and exposes a Local boards section when server is not configured", async () => {
    mockIsWhiteboardServerConfigured.mockReturnValue(false);
    mockGetLocalBoardsRepository.mockReturnValue({
      listBoards: jest.fn().mockResolvedValue([
        {
          id: "local-1",
          name: "Local board",
          boardType: "advanced",
          createdAt: "2026-03-07T10:00:00Z",
          updatedAt: "2026-03-07T10:00:00Z",
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
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={<ModelProbe auth={{ configured: false, authenticated: false, login: jest.fn() }} />}
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByTestId("items")).toHaveTextContent("local:local-1"));
    expect(screen.getByTestId("sections")).toHaveTextContent("local:Local boards:1");
    expect(screen.getByTestId("boards")).toHaveTextContent("local-1");
  });

  test("aggregates remote and invited board sections when server mode is authenticated", async () => {
    mockIsWhiteboardServerConfigured.mockReturnValue(true);
    mockGetLocalBoardsRepository.mockReturnValue({
      listBoards: jest.fn().mockResolvedValue([]),
      createBoard: jest.fn(),
      renameBoard: jest.fn(),
      deleteBoard: jest.fn(),
    });
    mockGetRemoteBoardsRepository.mockReturnValue({
      listBoards: jest.fn().mockResolvedValue([
        {
          id: "remote-1",
          name: "Remote board",
          boardType: "advanced",
          createdAt: "2026-03-07T11:00:00Z",
          updatedAt: "2026-03-07T11:00:00Z",
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
          title: "Invited board",
          inviteToken: "token-1",
          permission: "editor",
          expiresAt: null,
          lastOpenedAt: "2026-03-07T12:00:00Z",
        },
      ]),
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={<ModelProbe auth={{ configured: true, authenticated: true, login: jest.fn() }} />}
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId("items")).toHaveTextContent("remote:remote-1:dup:ren:del,invited:invite-1:nodup:noren:nodel")
    );
    expect(screen.getByTestId("sections")).toHaveTextContent("remote:My boards:1|invited:Invited boards:1");
    expect(screen.getByTestId("boards")).toHaveTextContent("remote-1,invite-1");
  });

  test("shows invited boards without requiring sign-in when server mode is signed out and invite records exist", async () => {
    mockIsWhiteboardServerConfigured.mockReturnValue(true);
    mockGetLocalBoardsRepository.mockReturnValue({
      listBoards: jest.fn().mockResolvedValue([]),
      createBoard: jest.fn(),
      renameBoard: jest.fn(),
      deleteBoard: jest.fn(),
    });
    mockGetInvitedBoardsRepository.mockReturnValue({
      listInvitedBoards: jest.fn().mockResolvedValue([
        {
          boardId: "invite-2",
          title: "Shared board",
          inviteToken: "token-2",
          permission: "viewer",
          expiresAt: null,
          lastOpenedAt: "2026-03-07T13:00:00Z",
        },
      ]),
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={<ModelProbe auth={{ configured: true, authenticated: false, login: jest.fn() }} />}
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByTestId("items")).toHaveTextContent("invited:invite-2"));
    expect(screen.getByTestId("sections")).toHaveTextContent("invited:Invited boards:1");
    expect(screen.getByTestId("load-state")).toHaveTextContent("loaded");
    expect(screen.getByTestId("needs-auth")).toHaveTextContent("false");
  });

  test("keeps sign-in prompt behavior when server mode is signed out and no invited boards exist", async () => {
    mockIsWhiteboardServerConfigured.mockReturnValue(true);
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
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={<ModelProbe auth={{ configured: true, authenticated: false, login: jest.fn() }} />}
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByTestId("load-state")).toHaveTextContent("error"));
    expect(screen.getByTestId("error")).toHaveTextContent("Sign in is required to load your boards.");
    expect(screen.getByTestId("needs-auth")).toHaveTextContent("true");
  });

  test("keeps existing local boards as an explicit Local drafts section in authenticated server mode", async () => {
    mockIsWhiteboardServerConfigured.mockReturnValue(true);
    mockGetLocalBoardsRepository.mockReturnValue({
      listBoards: jest.fn().mockResolvedValue([
        {
          id: "local-draft-1",
          name: "Offline draft",
          boardType: "advanced",
          createdAt: "2026-03-07T10:30:00Z",
          updatedAt: "2026-03-07T10:45:00Z",
        },
      ]),
      createBoard: jest.fn(),
      renameBoard: jest.fn(),
      deleteBoard: jest.fn(),
    });
    mockGetRemoteBoardsRepository.mockReturnValue({
      listBoards: jest.fn().mockResolvedValue([
        {
          id: "remote-keep-1",
          name: "Server board",
          boardType: "advanced",
          createdAt: "2026-03-07T11:00:00Z",
          updatedAt: "2026-03-07T11:00:00Z",
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
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={<ModelProbe auth={{ configured: true, authenticated: true, login: jest.fn() }} />}
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByTestId("load-state")).toHaveTextContent("loaded"));
    expect(screen.getByTestId("sections")).toHaveTextContent("remote:My boards:1|local:Local drafts:1");
    expect(screen.getByTestId("boards")).toHaveTextContent("remote-keep-1,local-draft-1");
  });

  test("marks invited board items as open-only while keeping remote board actions enabled", async () => {
    mockIsWhiteboardServerConfigured.mockReturnValue(true);
    mockGetLocalBoardsRepository.mockReturnValue({
      listBoards: jest.fn().mockResolvedValue([]),
      createBoard: jest.fn(),
      renameBoard: jest.fn(),
      deleteBoard: jest.fn(),
    });
    mockGetRemoteBoardsRepository.mockReturnValue({
      listBoards: jest.fn().mockResolvedValue([
        {
          id: "remote-2",
          name: "Remote editable",
          boardType: "advanced",
          createdAt: "2026-03-07T11:00:00Z",
          updatedAt: "2026-03-07T11:00:00Z",
        },
      ]),
      createBoard: jest.fn(),
      renameBoard: jest.fn(),
      deleteBoard: jest.fn(),
    });
    mockGetInvitedBoardsRepository.mockReturnValue({
      listInvitedBoards: jest.fn().mockResolvedValue([
        {
          boardId: "invite-3",
          title: "Open only board",
          inviteToken: "token-3",
          permission: "viewer",
          expiresAt: null,
          lastOpenedAt: "2026-03-07T12:00:00Z",
        },
      ]),
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={<ModelProbe auth={{ configured: true, authenticated: true, login: jest.fn() }} />}
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId("items")).toHaveTextContent("remote:remote-2:dup:ren:del,invited:invite-3:nodup:noren:nodel")
    );
  });
});
