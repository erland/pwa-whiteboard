import { WhiteboardMeta } from './types';

/**
 * Simple index of boards for the board list page.
 */
export type BoardsIndex = WhiteboardMeta[];

/**
 * Abstraction for listing and managing boards.
 * Implementation will be added in a later step (local storage, etc.).
 */
export interface BoardsRepository {
  listBoards(): Promise<BoardsIndex>;
  createBoard(name: string): Promise<WhiteboardMeta>;
  renameBoard(id: string, name: string): Promise<void>;
  deleteBoard(id: string): Promise<void>;
}

/**
 * Abstraction for loading/saving the full state of a single board.
 */
export interface WhiteboardRepository {
  loadBoard(id: string): Promise<unknown>;
  saveBoard(id: string, state: unknown): Promise<void>;
}
