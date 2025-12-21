import type { BoardsIndex, BoardsRepository } from '../domain/boardsIndex';
import type { BoardTypeId, WhiteboardId, WhiteboardMeta } from '../domain/types';

const BOARDS_INDEX_KEY = 'pwa-whiteboard.boardsIndex';
const BOARD_STATE_PREFIX = 'pwa-whiteboard.board.';

function generateId(): string {
  // Use UUIDs so boards can be referenced server-side (Supabase uses uuid primary keys).
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as any).randomUUID() as string;
  }
  // Fallback: keep previous local id style.
  return 'b_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
}


const DEFAULT_BOARD_TYPE: BoardTypeId = 'advanced';

function isBoardType(value: unknown): value is BoardTypeId {
  return value === 'advanced' || value === 'freehand' || value === 'mindmap';
}

function migrateIndex(rawIndex: unknown[]): BoardsIndex {
  let changed = false;
  const next: BoardsIndex = [];

  for (const item of rawIndex) {
    if (!item || typeof item !== 'object') continue;
    const m = item as any;

    const id = typeof m.id === 'string' ? m.id : null;
    if (!id) continue;

    const name = typeof m.name === 'string' ? m.name : 'Untitled board';
    const createdAt = typeof m.createdAt === 'string' ? m.createdAt : new Date().toISOString();
    const updatedAt = typeof m.updatedAt === 'string' ? m.updatedAt : createdAt;
    const boardType = isBoardType(m.boardType) ? m.boardType : DEFAULT_BOARD_TYPE;

    if (m.name !== name) changed = true;
    if (m.createdAt !== createdAt) changed = true;
    if (m.updatedAt !== updatedAt) changed = true;
    if (m.boardType !== boardType) changed = true;

    next.push({
      id,
      name,
      boardType,
      createdAt,
      updatedAt
    });
  }

  // Persist the migrated index so we don't keep doing it every load.
  if (changed) {
    writeIndex(next);
  }

  return next;
}

function readIndex(): BoardsIndex {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(BOARDS_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return migrateIndex(parsed);
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

  async createBoard(name: string, boardType?: BoardTypeId): Promise<WhiteboardMeta> {
    const now = new Date().toISOString();
    const id = generateId();
    const nextType = isBoardType(boardType) ? boardType : DEFAULT_BOARD_TYPE;
    const meta: WhiteboardMeta = {
      id,
      name: name.trim() || 'Untitled board',
      boardType: nextType,
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

  async setBoardType(id: WhiteboardId, boardType: BoardTypeId): Promise<void> {
    const nextType = isBoardType(boardType) ? boardType : DEFAULT_BOARD_TYPE;
    const index = readIndex();
    const next = index.map((meta) =>
      meta.id === id
        ? {
            ...meta,
            boardType: nextType,
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
