import {
  getInvitedBoardsRepository,
  type InvitedBoardRecord,
} from '../localStorageInvitedBoardsRepository';

describe('localStorageInvitedBoardsRepository', () => {
  const repo = getInvitedBoardsRepository();

  beforeEach(async () => {
    window.localStorage.clear();
    await repo.clearInvitedBoards();
  });

  it('saves and lists invited boards sorted by lastOpenedAt descending', async () => {
    const older: InvitedBoardRecord = {
      boardId: 'board-1',
      title: 'Board one',
      inviteToken: 'token-1',
      permission: 'viewer',
      lastOpenedAt: '2026-03-01T09:00:00.000Z',
    };
    const newer: InvitedBoardRecord = {
      boardId: 'board-2',
      title: 'Board two',
      inviteToken: 'token-2',
      permission: 'editor',
      expiresAt: '2026-03-08T09:00:00.000Z',
      lastOpenedAt: '2026-03-02T09:00:00.000Z',
    };

    await repo.saveInvitedBoard(older);
    await repo.saveInvitedBoard(newer);

    await expect(repo.listInvitedBoards()).resolves.toEqual([newer, older]);
  });

  it('updates an existing board record instead of duplicating it', async () => {
    await repo.saveInvitedBoard({
      boardId: 'board-1',
      title: 'Old title',
      inviteToken: 'token-1',
      permission: 'viewer',
      lastOpenedAt: '2026-03-01T09:00:00.000Z',
    });

    await repo.saveInvitedBoard({
      boardId: 'board-1',
      title: 'New title',
      inviteToken: 'token-2',
      permission: 'editor',
      lastOpenedAt: '2026-03-03T09:00:00.000Z',
    });

    await expect(repo.listInvitedBoards()).resolves.toEqual([
      {
        boardId: 'board-1',
        title: 'New title',
        inviteToken: 'token-2',
        permission: 'editor',
        expiresAt: undefined,
        lastOpenedAt: '2026-03-03T09:00:00.000Z',
      },
    ]);
  });

  it('removes records by board id', async () => {
    await repo.saveInvitedBoard({
      boardId: 'board-1',
      title: 'Board one',
      inviteToken: 'token-1',
      lastOpenedAt: '2026-03-01T09:00:00.000Z',
    });

    await repo.removeInvitedBoard('board-1');

    await expect(repo.listInvitedBoards()).resolves.toEqual([]);
    await expect(repo.getInvitedBoard('board-1')).resolves.toBeNull();
  });

  it('normalizes persisted records and filters out invalid entries', async () => {
    window.localStorage.setItem(
      'pwa-whiteboard.invitedBoards.v1',
      JSON.stringify([
        {
          boardId: 'board-1',
          title: '',
          inviteToken: 'token-1',
          permission: 'invalid',
          lastOpenedAt: '2026-03-01T09:00:00.000Z',
        },
        {
          boardId: '  ',
          inviteToken: 'token-2',
        },
      ])
    );

    await expect(repo.listInvitedBoards()).resolves.toEqual([
      {
        boardId: 'board-1',
        title: 'Invited board',
        inviteToken: 'token-1',
        permission: undefined,
        expiresAt: undefined,
        lastOpenedAt: '2026-03-01T09:00:00.000Z',
      },
    ]);
  });
});
