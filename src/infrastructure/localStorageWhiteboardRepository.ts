// src/infrastructure/localStorageWhiteboardRepository.ts
import type { BoardTypeId, WhiteboardId, WhiteboardState } from '../domain/types';
import type { WhiteboardRepository } from '../domain/boardsIndex';

const BOARD_STATE_PREFIX = 'pwa-whiteboard.board.';


const DEFAULT_BOARD_TYPE: BoardTypeId = 'advanced';

function isBoardType(value: unknown): value is BoardTypeId {
  return value === 'advanced' || value === 'freehand' || value === 'brainstorming';
}

function migrateLoadedState(state: WhiteboardState): WhiteboardState {
  const metaAny = (state as any).meta ?? {};
  const boardType = isBoardType(metaAny.boardType) ? metaAny.boardType : DEFAULT_BOARD_TYPE;

  if (metaAny.boardType === boardType) {
    return state;
  }

  return {
    ...state,
    meta: {
      ...state.meta,
      boardType,
    },
  };
}


class LocalStorageWhiteboardRepository implements WhiteboardRepository {
  async loadBoard(id: WhiteboardId): Promise<WhiteboardState | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(BOARD_STATE_PREFIX + id);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);

      // Normal case: we stored the raw WhiteboardState
      if (parsed && typeof parsed === 'object' && 'meta' in parsed && 'objects' in parsed) {
        return migrateLoadedState(parsed as WhiteboardState);
      }

      // Fallback: if we ever decide to wrap it as { state: ... }
      if (parsed && typeof parsed === 'object' && 'state' in parsed) {
        return migrateLoadedState((parsed as any).state as WhiteboardState);
      }

      return null;
    } catch (err) {
      console.error('Failed to load board from localStorage', err);
      return null;
    }
  }

  async saveBoard(id: WhiteboardId, state: WhiteboardState): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const raw = JSON.stringify(state);
      window.localStorage.setItem(BOARD_STATE_PREFIX + id, raw);
    } catch (err) {
      console.error('Failed to save board to localStorage', err);
    }
  }
}

let instance: WhiteboardRepository | null = null;

export function getWhiteboardRepository(): WhiteboardRepository {
  if (!instance) {
    instance = new LocalStorageWhiteboardRepository();
  }
  return instance;
}
