import { getBoardsRepository } from '../localStorageBoardsRepository';

beforeEach(() => {
  window.localStorage.clear();
});

describe('LocalStorageBoardsRepository', () => {
  it('creates and lists boards', async () => {
    const repo = getBoardsRepository();
    const before = await repo.listBoards();
    expect(before).toHaveLength(0);

    const meta = await repo.createBoard('My board');
    expect(meta.id).toBeTruthy();

    const after = await repo.listBoards();
    expect(after).toHaveLength(1);
    expect(after[0].name).toBe('My board');
  });

  it('renames and deletes boards', async () => {
    const repo = getBoardsRepository();
    const meta = await repo.createBoard('Old name');

    await repo.renameBoard(meta.id, 'New name');
    let list = await repo.listBoards();
    expect(list[0].name).toBe('New name');

    await repo.deleteBoard(meta.id);
    list = await repo.listBoards();
    expect(list).toHaveLength(0);
  });
});
