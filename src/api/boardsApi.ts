import type { BoardTypeId, WhiteboardId, WhiteboardMeta } from '../domain/types';
import { getApiBaseUrl } from '../config/server';
import { getAccessToken } from '../auth/oidc';
import { createHttpClient } from './httpClient';

/**
 * Server board types are currently coarse-grained.
 * The PWA still supports multiple client-side board variants (advanced/freehand/mindmap).
 * Until the server exposes a dedicated field for this, we persist the client's boardType locally.
 */
const BOARD_TYPE_MAP_KEY = 'pwa-whiteboard.boardTypeMap';

type ServerBoard = {
  id: string;
  name: string;
  type: string;
  ownerUserId: string;
  status: 'ACTIVE' | 'ARCHIVED' | string;
  createdAt: string;
  updatedAt: string;
};

function readBoardTypeMap(): Record<string, BoardTypeId> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(BOARD_TYPE_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, BoardTypeId>;
  } catch {
    return {};
  }
}

function writeBoardTypeMap(map: Record<string, BoardTypeId>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BOARD_TYPE_MAP_KEY, JSON.stringify(map));
}

export function getPersistedBoardType(boardId: WhiteboardId): BoardTypeId | null {
  const map = readBoardTypeMap();
  return (map[boardId] as BoardTypeId | undefined) ?? null;
}

export function setPersistedBoardType(boardId: WhiteboardId, boardType: BoardTypeId): void {
  const map = readBoardTypeMap();
  map[boardId] = boardType;
  writeBoardTypeMap(map);
}

function serverBoardToMeta(b: ServerBoard): WhiteboardMeta {
  const persisted = getPersistedBoardType(b.id);
  return {
    id: b.id,
    name: b.name,
    boardType: persisted ?? 'advanced',
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

function http() {
  return createHttpClient({
    baseUrl: getApiBaseUrl()!,
    getAccessToken,
  });
}

export async function listBoards(): Promise<WhiteboardMeta[]> {
  const res = await http().get<{ boards: ServerBoard[] }>('/boards');
  return (res.boards ?? []).map(serverBoardToMeta);
}

export async function createBoard(args: { name: string; boardType: BoardTypeId }): Promise<WhiteboardMeta> {
  const created = await http().post<ServerBoard>('/boards', {
    json: { name: args.name, type: 'whiteboard' },
  });
  // Persist client boardType locally until server supports it.
  setPersistedBoardType(created.id as WhiteboardId, args.boardType);
  return serverBoardToMeta(created);
}

export async function renameBoard(boardId: WhiteboardId, name: string): Promise<WhiteboardMeta> {
  const updated = await http().put<ServerBoard>(`/boards/${encodeURIComponent(boardId)}`, {
    json: { name, type: 'whiteboard' },
  });
  return serverBoardToMeta(updated);
}

export async function deleteBoard(boardId: WhiteboardId): Promise<void> {
  await http().del<void>(`/boards/${encodeURIComponent(boardId)}`);
}
