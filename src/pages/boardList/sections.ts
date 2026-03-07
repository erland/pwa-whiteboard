import type { WhiteboardMeta } from '../../domain/types';
import type { BoardListItem, BoardListItemActions, BoardListSection, BoardListSectionInput, BoardListSource } from './types';

function getBoardListItemActions(source: BoardListSource): BoardListItemActions {
  if (source === 'invited') {
    return {
      canDuplicate: false,
      canRename: false,
      canDelete: false,
    };
  }

  return {
    canDuplicate: true,
    canRename: true,
    canDelete: true,
  };
}

export function createBoardListItems(source: BoardListSource, boards: WhiteboardMeta[]): BoardListItem[] {
  const actions = getBoardListItemActions(source);
  return boards.map((board) => ({
    id: `${source}:${board.id}`,
    source,
    board,
    actions,
  }));
}

export function buildBoardListSections(inputs: BoardListSectionInput[]): BoardListSection[] {
  return inputs
    .map((input) => ({
      id: input.source,
      title: input.title,
      items: createBoardListItems(input.source, input.boards),
    }))
    .filter((section) => section.items.length > 0);
}

export function flattenBoardListSections(sections: BoardListSection[]): WhiteboardMeta[] {
  return sections.flatMap((section) => section.items.map((item) => item.board));
}

export function buildDefaultBoardListSections(serverConfigured: boolean, sources: { local: WhiteboardMeta[]; remote: WhiteboardMeta[]; invited: WhiteboardMeta[]; }): BoardListSection[] {
  if (!serverConfigured) {
    return buildBoardListSections([
      { source: 'local', title: 'Local boards', boards: sources.local },
    ]);
  }

  return buildBoardListSections([
    { source: 'remote', title: 'My boards', boards: sources.remote },
    { source: 'invited', title: 'Invited boards', boards: sources.invited },
    { source: 'local', title: 'Local drafts', boards: sources.local },
  ]);
}
