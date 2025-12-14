import { getBoardsRepository } from '../localStorageBoardsRepository';

beforeEach(() => {
  window.localStorage.clear();
});

describe('LocalStorageBoardsRepository', () => {
  it('creates and lists boards', async () => {
    const repo = getBoardsRepository();
    const before = await repo.listBoards();
    expect(before).toHaveLength(0);

    const meta = await repo.createBoard('My board', 'advanced');
    expect(meta.id).toBeTruthy();
    expect((meta as any).boardType).toBe('advanced');

    const after = await repo.listBoards();
    expect(after).toHaveLength(1);
    expect(after[0].name).toBe('My board');
  });



it('migrates legacy boards index entries missing boardType', async () => {
  // Simulate an old index entry (pre-boardType)
  window.localStorage.setItem(
    'pwa-whiteboard.boardsIndex',
    JSON.stringify([
      {
        id: 'b_legacy',
        name: 'Legacy board',
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-02T00:00:00.000Z'
      }
    ])
  );

  const repo = getBoardsRepository();
  const list = await repo.listBoards();
  expect(list).toHaveLength(1);
  expect(list[0].id).toBe('b_legacy');
  expect((list[0] as any).boardType).toBe('advanced');

  // And ensure we persisted the migrated index
  const raw = window.localStorage.getItem('pwa-whiteboard.boardsIndex');
  expect(raw).toContain('"boardType":"advanced"');
});

  it('renames and deletes boards', async () => {
    const repo = getBoardsRepository();
    const meta = await repo.createBoard('Old name', 'advanced');

    await repo.renameBoard(meta.id, 'New name');
    let list = await repo.listBoards();
    expect(list[0].name).toBe('New name');

    await repo.deleteBoard(meta.id);
    list = await repo.listBoards();
    expect(list).toHaveLength(0);
  });

  it('updates board type', async () => {
    const repo = getBoardsRepository();
    const meta = await repo.createBoard('Type board', 'advanced');

    await repo.setBoardType(meta.id, 'freehand');
    const list = await repo.listBoards();
    const updated = list.find((b) => b.id === meta.id);
    expect(updated?.boardType).toBe('freehand');
  });
});
