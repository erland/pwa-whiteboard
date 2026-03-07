import type { WhiteboardMeta } from '../../../domain/types';
import { buildBoardListSections, buildDefaultBoardListSections, createBoardListItems, flattenBoardListSections } from '../sections';

const LOCAL_BOARD: WhiteboardMeta = {
  id: 'local-1',
  name: 'Local draft',
  boardType: 'advanced',
  createdAt: '2026-03-07T10:00:00Z',
  updatedAt: '2026-03-07T10:00:00Z',
};

const REMOTE_BOARD: WhiteboardMeta = {
  id: 'remote-1',
  name: 'Remote board',
  boardType: 'mindmap',
  createdAt: '2026-03-07T11:00:00Z',
  updatedAt: '2026-03-07T11:00:00Z',
};

describe('boardList sections', () => {
  test('createBoardListItems tags each board with its source', () => {
    const items = createBoardListItems('local', [LOCAL_BOARD]);

    expect(items).toEqual([
      {
        id: 'local:local-1',
        source: 'local',
        board: LOCAL_BOARD,
        actions: {
          canDuplicate: true,
          canRename: true,
          canDelete: true,
        },
      },
    ]);
  });

  test('buildBoardListSections keeps only non-empty sections and preserves section titles', () => {
    const sections = buildBoardListSections([
      { source: 'remote', title: 'My boards', boards: [REMOTE_BOARD] },
      { source: 'invited', title: 'Invited boards', boards: [] },
      { source: 'local', title: 'Local drafts', boards: [LOCAL_BOARD] },
    ]);

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({ id: 'remote', title: 'My boards' });
    expect(sections[1]).toMatchObject({ id: 'local', title: 'Local drafts' });
    expect(sections[0].items[0].source).toBe('remote');
    expect(sections[1].items[0].source).toBe('local');
  });

  test('flattenBoardListSections returns the original board order across sections', () => {
    const sections = buildBoardListSections([
      { source: 'remote', title: 'My boards', boards: [REMOTE_BOARD] },
      { source: 'local', title: 'Local drafts', boards: [LOCAL_BOARD] },
    ]);

    expect(flattenBoardListSections(sections)).toEqual([REMOTE_BOARD, LOCAL_BOARD]);
  });
});




  test('buildDefaultBoardListSections centralizes standard section titles for server mode', () => {
    const sections = buildDefaultBoardListSections(true, {
      local: [LOCAL_BOARD],
      remote: [REMOTE_BOARD],
      invited: [],
    });

    expect(sections.map((section) => `${section.id}:${section.title}`)).toEqual([
      'remote:My boards',
      'local:Local drafts',
    ]);
  });

  test('createBoardListItems makes invited boards open-only', () => {
    const items = createBoardListItems('invited', [REMOTE_BOARD]);

    expect(items[0].actions).toEqual({
      canDuplicate: false,
      canRename: false,
      canDelete: false,
    });
  });
