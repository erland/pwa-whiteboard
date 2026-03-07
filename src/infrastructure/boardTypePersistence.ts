import type { BoardTypeId, WhiteboardId } from '../domain/types';
import { coerceBoardType } from '../domain/boardType';

const BOARD_TYPE_MAP_KEY = 'pwa-whiteboard.boardTypeMap';

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function readBoardTypeMap(): Record<string, BoardTypeId> {
  if (!canUseLocalStorage()) return {};
  try {
    const raw = window.localStorage.getItem(BOARD_TYPE_MAP_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    const next: Record<string, BoardTypeId> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      next[key] = coerceBoardType(value);
    }
    return next;
  } catch {
    return {};
  }
}

export function writeBoardTypeMap(map: Record<string, BoardTypeId>): void {
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(BOARD_TYPE_MAP_KEY, JSON.stringify(map));
}

export function getPersistedBoardType(boardId: WhiteboardId): BoardTypeId | null {
  const map = readBoardTypeMap();
  return map[boardId] ?? null;
}

export function setPersistedBoardType(boardId: WhiteboardId, boardType: BoardTypeId): void {
  const map = readBoardTypeMap();
  map[boardId] = coerceBoardType(boardType);
  writeBoardTypeMap(map);
}

export function deletePersistedBoardType(boardId: WhiteboardId): void {
  const map = readBoardTypeMap();
  if (!(boardId in map)) return;
  delete map[boardId];
  writeBoardTypeMap(map);
}
