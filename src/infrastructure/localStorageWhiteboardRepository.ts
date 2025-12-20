// src/infrastructure/localStorageWhiteboardRepository.ts
import type {
  BoardEvent,
  BoardTypeId,
  WhiteboardId,
  WhiteboardMeta,
  WhiteboardState,
} from '../domain/types';
import type { WhiteboardRepository } from '../domain/boardsIndex';
import { applyEvent, createEmptyWhiteboardState } from '../domain/whiteboardState';

const BOARD_STATE_PREFIX = 'pwa-whiteboard.board.';


const DEFAULT_BOARD_TYPE: BoardTypeId = 'advanced';

/**
 * LocalStorage has a small quota (~5MB in many browsers). Persisting full undo/redo history
 * quickly exceeds that (especially for freehand strokes). We therefore persist a compact
 * "snapshot" of the current board state (no history), and we also pack freehand points.
 */
const PERSIST_SCHEMA_VERSION = 2 as const;
const FREEHAND_POINTS_SCALE = 10; // store points as integers (x*scale,y*scale)

type PersistedBoardStateV2 = {
  schemaVersion: typeof PERSIST_SCHEMA_VERSION;
  meta: WhiteboardMeta;
  objects: any[];
  selectedObjectIds: any[];
  viewport: any;
};

function packPoints(points: Array<{ x: number; y: number }>): string {
  // "x,y;x,y;..." where x/y are ints at FREEHAND_POINTS_SCALE
  // This is much smaller than JSON arrays of {x,y} objects.
  const scale = FREEHAND_POINTS_SCALE;
  let out = '';
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const x = Math.round(p.x * scale);
    const y = Math.round(p.y * scale);
    out += `${x},${y}`;
    if (i !== points.length - 1) out += ';';
  }
  return out;
}

function unpackPoints(packed: string, scale = FREEHAND_POINTS_SCALE): Array<{ x: number; y: number }> {
  if (!packed) return [];
  const parts = packed.split(';');
  const pts: Array<{ x: number; y: number }> = [];
  for (const part of parts) {
    const [xs, ys] = part.split(',');
    const xi = Number(xs);
    const yi = Number(ys);
    if (!Number.isFinite(xi) || !Number.isFinite(yi)) continue;
    pts.push({ x: xi / scale, y: yi / scale });
  }
  return pts;
}

function packObjectsForStorage(objects: any[]): any[] {
  return objects.map((o) => {
    if (o && o.type === 'freehand' && Array.isArray(o.points)) {
      const { points, ...rest } = o;
      return {
        ...rest,
        pointsPacked: packPoints(points),
        pointsScale: FREEHAND_POINTS_SCALE,
      };
    }
    return o;
  });
}

function unpackObjectsFromStorage(objects: any[]): any[] {
  return objects.map((o) => {
    if (o && o.type === 'freehand' && !Array.isArray(o.points) && typeof o.pointsPacked === 'string') {
      const scale = typeof o.pointsScale === 'number' ? o.pointsScale : FREEHAND_POINTS_SCALE;
      const { pointsPacked, pointsScale, ...rest } = o;
      return {
        ...rest,
        points: unpackPoints(pointsPacked, scale),
      };
    }
    return o;
  });
}

function snapshotToPersistedV2(id: WhiteboardId, state: WhiteboardState): PersistedBoardStateV2 {
  // Ensure meta is normalized (boardType always valid)
  const meta = asMeta(id, state.meta);
  return {
    schemaVersion: PERSIST_SCHEMA_VERSION,
    meta,
    objects: packObjectsForStorage(state.objects as any[]),
    selectedObjectIds: Array.isArray(state.selectedObjectIds) ? state.selectedObjectIds : [],
    viewport: state.viewport,
  };
}

function persistedV2ToState(id: WhiteboardId, parsed: PersistedBoardStateV2): WhiteboardState {
  const meta = asMeta(id, parsed.meta);
  const base = createEmptyWhiteboardState(meta);
  return {
    ...base,
    objects: unpackObjectsFromStorage(Array.isArray(parsed.objects) ? parsed.objects : []),
    selectedObjectIds: Array.isArray(parsed.selectedObjectIds) ? parsed.selectedObjectIds : [],
    viewport: parsed.viewport ?? base.viewport,
  };
}

function isPersistedV2(v: any): v is PersistedBoardStateV2 {
  return !!v && typeof v === 'object' && v.schemaVersion === PERSIST_SCHEMA_VERSION && 'meta' in v && 'objects' in v;
}


function isBoardType(value: unknown): value is BoardTypeId {
  return value === 'advanced' || value === 'freehand' || value === 'mindmap';
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function asMeta(id: WhiteboardId, rawMeta: unknown): WhiteboardMeta {
  const now = new Date().toISOString();
  const m = isRecord(rawMeta) ? (rawMeta as Record<string, unknown>) : {};

  const name = typeof m.name === 'string' ? m.name : 'Untitled board';
  const createdAt = typeof m.createdAt === 'string' ? m.createdAt : now;
  const updatedAt = typeof m.updatedAt === 'string' ? m.updatedAt : createdAt;
  const boardType = isBoardType(m.boardType) ? (m.boardType as BoardTypeId) : DEFAULT_BOARD_TYPE;

  return {
    id,
    name,
    boardType,
    createdAt,
    updatedAt,
  };
}

/**
 * Back-compat loader:
 * Some earlier versions can store history-only payloads (meta + pastEvents) instead of full state.
 * When detected, we rebuild a full state by replaying events.
 */
function tryRebuildFromHistory(id: WhiteboardId, parsed: unknown): WhiteboardState | null {
  if (!isRecord(parsed)) return null;

  const meta = asMeta(id, (parsed as any).meta);

  // Supported shapes:
  // - { meta, history: { pastEvents, futureEvents }, viewport?, selectedObjectIds? }
  // - { meta, pastEvents, futureEvents?, viewport?, selectedObjectIds? }
  const history = (parsed as any).history;
  const pastEventsRaw = Array.isArray(history?.pastEvents)
    ? history.pastEvents
    : Array.isArray((parsed as any).pastEvents)
      ? (parsed as any).pastEvents
      : null;

  if (!pastEventsRaw) return null;

  const futureEventsRaw = Array.isArray(history?.futureEvents)
    ? history.futureEvents
    : Array.isArray((parsed as any).futureEvents)
      ? (parsed as any).futureEvents
      : [];

  try {
    let state = createEmptyWhiteboardState(meta);
    for (const ev of pastEventsRaw as any[]) {
      state = applyEvent(state, ev as BoardEvent);
    }

    const updatedAt =
      pastEventsRaw.length > 0 && typeof (pastEventsRaw[pastEventsRaw.length - 1] as any).timestamp === 'string'
        ? (pastEventsRaw[pastEventsRaw.length - 1] as any).timestamp
        : meta.updatedAt;

    const viewport = isRecord((parsed as any).viewport) ? (parsed as any).viewport : null;
    const selectedObjectIds = Array.isArray((parsed as any).selectedObjectIds)
      ? (parsed as any).selectedObjectIds
      : null;

    const rebuilt: WhiteboardState = {
      ...state,
      meta: {
        ...state.meta,
        updatedAt,
      },
      viewport: viewport ? ({ ...state.viewport, ...(viewport as any) } as any) : state.viewport,
      selectedObjectIds: selectedObjectIds ? [...(selectedObjectIds as any[])] : state.selectedObjectIds,
      history: {
        pastEvents: [...(pastEventsRaw as any[])],
        futureEvents: [...(futureEventsRaw as any[])],
      },
    };

    return rebuilt;
  } catch (err) {
    console.error('Failed to rebuild board from history payload', err);
    return null;
  }
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

      // Preferred persisted shape (compact snapshot, no history)
      if (isPersistedV2(parsed)) {
        return migrateLoadedState(persistedV2ToState(id, parsed));
      }

      // Normal case: we stored the raw WhiteboardState
      if (parsed && typeof parsed === 'object' && 'meta' in parsed && 'objects' in parsed) {
        const loaded = migrateLoadedState(parsed as WhiteboardState);
        // Support packed freehand points even in older persisted shapes
        const objs = Array.isArray((loaded as any).objects) ? unpackObjectsFromStorage((loaded as any).objects) : loaded.objects;
        return { ...loaded, objects: objs as any };
      }

      // Back-compat: history-only storage → rebuild full state
      const rebuilt = tryRebuildFromHistory(id, parsed);
      if (rebuilt) {
        // Opportunistically normalize storage to the modern full-state shape.
        // This makes subsequent loads fast and avoids repeated rebuild work.
        try {
          window.localStorage.setItem(BOARD_STATE_PREFIX + id, JSON.stringify(snapshotToPersistedV2(id, rebuilt)));
        } catch {
          // ignore
        }
        return migrateLoadedState(rebuilt);
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
      const payload = snapshotToPersistedV2(id, state);
      const raw = JSON.stringify(payload);
      window.localStorage.setItem(BOARD_STATE_PREFIX + id, raw);
    } catch (err) {
      // If quota is exceeded, retry with an even smaller payload (drop selection + viewport).
      const isQuota =
        typeof err === 'object' &&
        err !== null &&
        ((err as any).name === 'QuotaExceededError' || (err as any).code === 22);

      if (isQuota) {
        try {
          const meta = asMeta(id, state.meta);
          const minimal = {
            schemaVersion: PERSIST_SCHEMA_VERSION,
            meta,
            objects: packObjectsForStorage(state.objects as any[]),
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
