import type { WhiteboardMeta } from '../../domain/types';

export type BoardListSource = 'local' | 'remote' | 'invited';

export type BoardListSectionId = BoardListSource;

export type BoardListItemActions = {
  canDuplicate: boolean;
  canRename: boolean;
  canDelete: boolean;
};

export type BoardListItem = {
  id: string;
  source: BoardListSource;
  board: WhiteboardMeta;
  actions: BoardListItemActions;
};

export type BoardListSection = {
  id: BoardListSectionId;
  title: string;
  items: BoardListItem[];
};

export type BoardListSectionInput = {
  source: BoardListSource;
  title: string;
  boards: WhiteboardMeta[];
};
