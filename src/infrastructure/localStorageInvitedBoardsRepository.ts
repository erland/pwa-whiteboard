import type { InvitePermission } from '../api/invitesApi';

const INVITED_BOARDS_KEY = 'pwa-whiteboard.invitedBoards.v1';

export type InvitedBoardRecord = {
  boardId: string;
  title: string;
  inviteToken: string;
  permission?: InvitePermission;
  expiresAt?: string;
  lastOpenedAt: string;
};

export interface InvitedBoardsRepository {
  listInvitedBoards: () => Promise<InvitedBoardRecord[]>;
  getInvitedBoard: (boardId: string) => Promise<InvitedBoardRecord | null>;
  saveInvitedBoard: (record: InvitedBoardRecord) => Promise<void>;
  removeInvitedBoard: (boardId: string) => Promise<void>;
  clearInvitedBoards: () => Promise<void>;
}

function isInvitePermission(value: unknown): value is InvitePermission {
  return value === 'viewer' || value === 'editor';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function normalizeInvitedBoardRecord(value: unknown): InvitedBoardRecord | null {
  if (!isRecord(value)) return null;

  const boardId = typeof value.boardId === 'string' ? value.boardId.trim() : '';
  const inviteToken = typeof value.inviteToken === 'string' ? value.inviteToken.trim() : '';
  if (!boardId || !inviteToken) return null;

  const title = typeof value.title === 'string' && value.title.trim() ? value.title.trim() : 'Invited board';
  const permission = isInvitePermission(value.permission) ? value.permission : undefined;
  const expiresAt = typeof value.expiresAt === 'string' && value.expiresAt.trim() ? value.expiresAt : undefined;
  const lastOpenedAt = typeof value.lastOpenedAt === 'string' && value.lastOpenedAt.trim()
    ? value.lastOpenedAt
    : new Date().toISOString();

  return {
    boardId,
    title,
    inviteToken,
    permission,
    expiresAt,
    lastOpenedAt,
  };
}

function readInvitedBoards(): InvitedBoardRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(INVITED_BOARDS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const normalized = parsed
      .map(normalizeInvitedBoardRecord)
      .filter((entry): entry is InvitedBoardRecord => entry !== null)
      .sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));

    window.localStorage.setItem(INVITED_BOARDS_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return [];
  }
}

function writeInvitedBoards(records: InvitedBoardRecord[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(INVITED_BOARDS_KEY, JSON.stringify(records));
}

class LocalStorageInvitedBoardsRepository implements InvitedBoardsRepository {
  async listInvitedBoards(): Promise<InvitedBoardRecord[]> {
    return readInvitedBoards();
  }

  async getInvitedBoard(boardId: string): Promise<InvitedBoardRecord | null> {
    return readInvitedBoards().find((entry) => entry.boardId === boardId) ?? null;
  }

  async saveInvitedBoard(record: InvitedBoardRecord): Promise<void> {
    const normalized = normalizeInvitedBoardRecord(record);
    if (!normalized) {
      throw new Error('Invalid invited board record.');
    }

    const records = readInvitedBoards().filter((entry) => entry.boardId !== normalized.boardId);
    records.push(normalized);
    records.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
    writeInvitedBoards(records);
  }

  async removeInvitedBoard(boardId: string): Promise<void> {
    const records = readInvitedBoards().filter((entry) => entry.boardId !== boardId);
    writeInvitedBoards(records);
  }

  async clearInvitedBoards(): Promise<void> {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(INVITED_BOARDS_KEY);
  }
}

let instance: InvitedBoardsRepository | null = null;

export function getInvitedBoardsRepository(): InvitedBoardsRepository {
  if (!instance) {
    instance = new LocalStorageInvitedBoardsRepository();
  }
  return instance;
}
