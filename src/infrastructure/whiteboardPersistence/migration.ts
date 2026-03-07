import type {
  BoardEvent,
  WhiteboardId,
  WhiteboardMeta,
  WhiteboardState,
} from '../../domain/types';
import { DEFAULT_BOARD_TYPE, isBoardType } from '../../domain/boardType';
import { applyEvent, createEmptyWhiteboardState } from '../../domain/whiteboardState';

export function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

export function asMeta(id: WhiteboardId, rawMeta: unknown): WhiteboardMeta {
  const now = new Date().toISOString();
  const m = isRecord(rawMeta) ? (rawMeta as Record<string, unknown>) : {};

  const name = typeof m.name === 'string' ? m.name : 'Untitled board';
  const createdAt = typeof m.createdAt === 'string' ? m.createdAt : now;
  const updatedAt = typeof m.updatedAt === 'string' ? m.updatedAt : createdAt;
  const boardType = isBoardType(m.boardType) ? m.boardType : DEFAULT_BOARD_TYPE;

  return {
    id,
    name,
    boardType,
    createdAt,
    updatedAt,
  };
}

export function migrateLoadedState(state: WhiteboardState): WhiteboardState {
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

/**
 * Back-compat loader:
 * Some earlier versions can store history-only payloads (meta + pastEvents) instead of full state.
 * When detected, we rebuild a full state by replaying events.
 */
export function tryRebuildFromHistory(id: WhiteboardId, parsed: unknown): WhiteboardState | null {
  if (!isRecord(parsed)) return null;

  const meta = asMeta(id, (parsed as any).meta);
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
