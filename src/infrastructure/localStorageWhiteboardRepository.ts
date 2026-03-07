// src/infrastructure/localStorageWhiteboardRepository.ts
import type { WhiteboardId, WhiteboardState } from '../domain/types';
import type { WhiteboardRepository } from '../domain/boardsIndex';
import {
  BOARD_STATE_PREFIX,
  PERSIST_SCHEMA_VERSION,
  isPersistedV2,
  migrateLoadedState,
  persistedV2ToState,
  snapshotToPersistedV2,
  tryRebuildFromHistory,
  unpackObjectsFromStorage,
} from './whiteboardPersistence';

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

      if (isPersistedV2(parsed)) {
        return migrateLoadedState(persistedV2ToState(id, parsed));
      }

      if (parsed && typeof parsed === 'object' && 'meta' in parsed && 'objects' in parsed) {
        const loaded = migrateLoadedState(parsed as WhiteboardState);
        const objects = Array.isArray((loaded as any).objects)
          ? unpackObjectsFromStorage((loaded as any).objects)
          : loaded.objects;
        return { ...loaded, objects: objects as any };
      }

      const rebuilt = tryRebuildFromHistory(id, parsed);
      if (rebuilt) {
        try {
          window.localStorage.setItem(BOARD_STATE_PREFIX + id, JSON.stringify(snapshotToPersistedV2(id, rebuilt)));
        } catch {
          // ignore opportunistic write-back failures
        }
        return migrateLoadedState(rebuilt);
      }

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

    const payload = snapshotToPersistedV2(id, state);

    try {
      window.localStorage.setItem(BOARD_STATE_PREFIX + id, JSON.stringify(payload));
    } catch (err) {
      const isQuota =
        typeof err === 'object' &&
        err !== null &&
        ((err as any).name === 'QuotaExceededError' || (err as any).code === 22);

      if (isQuota) {
        try {
          const minimal = {
            schemaVersion: PERSIST_SCHEMA_VERSION,
            meta: payload.meta,
            objects: payload.objects,
            selectedObjectIds: [],
            viewport: undefined,
          };
          window.localStorage.setItem(BOARD_STATE_PREFIX + id, JSON.stringify(minimal));
          return;
        } catch {
          // fall through to logging
        }
      }

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
