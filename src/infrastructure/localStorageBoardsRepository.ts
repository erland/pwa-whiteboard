import type { BoardsIndex, BoardsRepository } from '../domain/boardsIndex';
import type { WhiteboardId, WhiteboardMeta } from '../domain/types';

const BOARDS_INDEX_KEY = 'pwa-whiteboard.boardsIndex';
const BOARD_STATE_PREFIX = 'pwa-whiteboard.board.';

function generateId(): string {
  // Simple unique-ish id, good enough for local single-user usage.
  return (
    'b_' +
    Math.random().toString(16).slice(2) +
    '_' +
    Date.now().toString(16)
  );
}

function readIndex(): BoardsIndex {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(BOARDS_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeIndex(index: BoardsIndex): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BOARDS_INDEX_KEY, JSON.stringify(index));
}

class LocalStorageBoardsRepository implements BoardsRepository {
  async listBoards(): Promise<BoardsIndex> {
    const index = readIndex();
    // Sort by updatedAt descending
    return [...index].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  async createBoard(name: string): Promise<WhiteboardMeta> {
    const now = new Date().toISOString();
    const id = generateId();
    const meta: WhiteboardMeta = {
      id,
      name: name.trim() || 'Untitled board',
      createdAt: now,
      updatedAt: now
    };
    const index = readIndex();
    index.push(meta);
    writeIndex(index);
    return meta;
  }

  async renameBoard(id: WhiteboardId, name: string): Promise<void> {
    const index = readIndex();
    const next = index.map((meta) =>
      meta.id === id
        ? {
            ...meta,
            name: name.trim() || meta.name,
            updatedAt: new Date().toISOString()
          }
        : meta
    );
    writeIndex(next);
  }

  async deleteBoard(id: WhiteboardId): Promise<void> {
    const index = readIndex();
    const next = index.filter((meta) => meta.id !== id);
    writeIndex(next);
    // Also remove any stored board state, if present
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(BOARD_STATE_PREFIX + id);
    }
  }
}

let instance: BoardsRepository | null = null;

export function getBoardsRepository(): BoardsRepository {
  if (!instance) {
    instance = new LocalStorageBoardsRepository();
  }
  return instance;
}
