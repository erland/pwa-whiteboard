import { applyEvent, createEmptyWhiteboardState } from '../../domain/whiteboardState';
import type {
  BoardEvent,
  HistoryState,
  ObjectId,
  WhiteboardMeta,
  WhiteboardObject,
  WhiteboardState,
} from '../../domain/types';
import { getBoardType } from '../boardTypes';
import { enforcePolicyOnEvent } from './policy';

export interface WhiteboardBaseline {
  objects: WhiteboardObject[];
  selectedObjectIds: ObjectId[];
}

export function cloneJson<T>(obj: T): T {
  try {
    // @ts-ignore
    if (typeof structuredClone === 'function') return structuredClone(obj);
  } catch {
    // ignore
  }
  return JSON.parse(JSON.stringify(obj)) as T;
}

export function cloneBaselineFrom(baseline: WhiteboardBaseline): WhiteboardBaseline {
  return {
    objects: cloneJson(baseline.objects),
    selectedObjectIds: [...baseline.selectedObjectIds],
  };
}

export function cloneBaseline(state: WhiteboardState): WhiteboardBaseline {
  return {
    objects: cloneJson(state.objects),
    selectedObjectIds: [...state.selectedObjectIds],
  };
}

export function ensureHistory(state: WhiteboardState): HistoryState {
  if (!state.history) {
    (state as any).history = {
      pastEvents: [],
      futureEvents: [],
    };
  }
  if (!state.history.baseline) {
    (state.history as any).baseline = cloneBaseline(state);
  }
  return state.history;
}

export function rebuildStateFromHistory(
  meta: WhiteboardMeta,
  pastEvents: BoardEvent[],
  baseline?: WhiteboardBaseline,
): WhiteboardState {
  let state = createEmptyWhiteboardState(meta);

  if (baseline) {
    state = {
      ...state,
      objects: cloneJson(baseline.objects),
      selectedObjectIds: [...baseline.selectedObjectIds],
    };
  }

  const boardTypeDef = getBoardType(meta.boardType);
  for (const event of pastEvents) {
    const enforced = enforcePolicyOnEvent(boardTypeDef, state, event);
    if (enforced) {
      state = applyEvent(state, enforced);
    }
  }

  const updatedAt = pastEvents.length > 0 ? pastEvents[pastEvents.length - 1].timestamp : meta.updatedAt;

  return {
    ...state,
    meta: {
      ...state.meta,
      updatedAt,
    },
    history: {
      pastEvents: [...pastEvents],
      futureEvents: [],
      baseline: baseline ? cloneBaselineFrom(baseline) : undefined,
    },
  };
}
