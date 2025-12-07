import type { WhiteboardMeta, WhiteboardState, WhiteboardId } from './types';

/**
 * Simple index of boards for the board list page.
 */
export type BoardsIndex = WhiteboardMeta[];

/**
 * Abstraction for listing and managing boards.
 */
export interface BoardsRepository {
  listBoards(): Promise<BoardsIndex>;
  createBoard(name: string): Promise<WhiteboardMeta>;
  renameBoard(id: WhiteboardId, name: string): Promise<void>;
  deleteBoard(id: WhiteboardId): Promise<void>;
}

/**
 * Abstraction for loading/saving the full state of a single board.
 * Concrete implementation will be added later.
 */
export interface WhiteboardRepository {
  loadBoard(id: WhiteboardId): Promise<WhiteboardState | null>;
  saveBoard(id: WhiteboardId, state: WhiteboardState): Promise<void>;
}
