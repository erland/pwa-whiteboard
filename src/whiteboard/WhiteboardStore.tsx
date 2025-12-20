// src/whiteboard/WhiteboardStore.tsx
import React, {
  createContext,
  useContext,
  useMemo,
  useReducer,
  useEffect,
  useState,
} from 'react';
import { applyEvent, createEmptyWhiteboardState } from '../domain/whiteboardState';
import type {
  BoardEvent,
  WhiteboardClipboardV1,
  WhiteboardMeta,
  WhiteboardState,
  Viewport,
  ObjectId,
  WhiteboardObject,
} from '../domain/types';
import { getWhiteboardRepository } from '../infrastructure/localStorageWhiteboardRepository';
import { getClipboardRepository } from '../infrastructure/localStorageClipboardRepository';
import { getBoardType, getLockedObjectProps } from './boardTypes';
import { createClipboardFromSelection, pasteClipboard } from './clipboard';

type WhiteboardAction =
  | { type: 'RESET_BOARD'; state: WhiteboardState }
  | { type: 'APPLY_EVENT'; event: BoardEvent }
  | { type: 'APPLY_REMOTE_EVENT'; event: BoardEvent }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_VIEWPORT'; patch: Partial<Viewport> }
  | { type: 'APPLY_TRANSIENT_OBJECT_PATCH'; objectId: ObjectId; patch: Partial<WhiteboardObject> };

interface WhiteboardContextValue {
  state: WhiteboardState | null;
  clipboard: WhiteboardClipboardV1 | null;
  dispatchEvent: (event: BoardEvent) => void;
  applyRemoteEvent: (event: BoardEvent) => void;
  /**
   * Can be called with:
   * - WhiteboardMeta → creates a fresh empty board
   * - WhiteboardState → directly sets an already loaded board
   */
  resetBoard: (metaOrState: WhiteboardMeta | WhiteboardState) => void;
  undo: () => void;
  redo: () => void;
  setViewport: (patch: Partial<Viewport>) => void;

  /** Applies a patch to an object for live interactions (drag/resize) WITHOUT creating an undo step. */
  applyTransientObjectPatch: (objectId: ObjectId, patch: Partial<WhiteboardObject>) => void;

  /** Copies the current selection into a cross-board clipboard (persisted best-effort). */
  copySelectionToClipboard: () => void;
  /** Pastes from clipboard into the current board (requires canvas size for cross-board centering). */
  pasteFromClipboard: (args?: { canvasWidth?: number; canvasHeight?: number }) => void;
  clearClipboard: () => void;
}

const WhiteboardContext = createContext<WhiteboardContextValue | undefined>(undefined);

/**
 * Helper to make sure we always have a history object.
 */
function ensureHistory(state: WhiteboardState) {
  if (!state.history) {
    (state as any).history = {
      pastEvents: [],
      futureEvents: []
    };
  }
  // Boards loaded from snapshot persistence won't have any history that can recreate
  // the existing objects. Capture a baseline snapshot once so UNDO/REDO rebuild
  // can start from the loaded board state rather than an empty board.
  if (!state.history.baseline) {
    (state.history as any).baseline = cloneBaseline(state);
  }
  return state.history;
}

/**
 * Rebuilds a whiteboard state from metadata and a list of past events.
 * Viewport will be whatever createEmptyWhiteboardState uses by default.
 */
function rebuildStateFromHistory(
  meta: WhiteboardMeta,
  pastEvents: BoardEvent[],
  baseline?: { objects: WhiteboardObject[]; selectedObjectIds: ObjectId[] }
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
  for (const ev of pastEvents) {
    const enforced = enforcePolicyOnEvent(boardTypeDef, state, ev);
    if (enforced) {
      state = applyEvent(state, enforced);
    }
  }

  const updatedAt =
    pastEvents.length > 0 ? pastEvents[pastEvents.length - 1].timestamp : meta.updatedAt;

  return {
    ...state,
    meta: {
      ...state.meta,
      updatedAt
    },
    history: {
      pastEvents: [...pastEvents],
      futureEvents: [],
      baseline: baseline ? cloneBaselineFrom(baseline) : undefined,
    }
  };
}

function cloneJson<T>(obj: T): T {
  // Whiteboard state is JSON-serializable; structuredClone may not exist in all environments.
  try {
    // @ts-ignore
    if (typeof structuredClone === 'function') return structuredClone(obj);
  } catch {
    // ignore
  }
  return JSON.parse(JSON.stringify(obj)) as T;
}

function cloneBaselineFrom(b: { objects: WhiteboardObject[]; selectedObjectIds: ObjectId[] }) {
  return {
    objects: cloneJson(b.objects),
    selectedObjectIds: [...b.selectedObjectIds],
  };
}

function cloneBaseline(state: WhiteboardState) {
  return {
    objects: cloneJson(state.objects),
    selectedObjectIds: [...state.selectedObjectIds],
  };
}

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Enforces board-type locked properties in the reducer.
 * - objectCreated: locked props are applied (override the created object)
 * - objectUpdated: patch is filtered to remove locked keys (no-op if empty)
 */
function enforcePolicyOnEvent(
  boardTypeDef: ReturnType<typeof getBoardType>,
  state: WhiteboardState,
  event: BoardEvent
): BoardEvent | null {
  if (event.type === 'objectCreated') {
    const obj = event.payload.object;
    const locked = getLockedObjectProps(boardTypeDef, obj.type);
    if (!locked || Object.keys(locked).length === 0) return event;
    return {
      ...event,
      payload: {
        ...event.payload,
        object: {
          ...obj,
          ...locked
        }
      }
    } as BoardEvent;
  }

  if (event.type === 'objectUpdated') {
    const target = state.objects.find((o) => o.id === event.payload.objectId);
    if (!target) return event;
    const locked = getLockedObjectProps(boardTypeDef, target.type);
    if (!locked || Object.keys(locked).length === 0) return event;

    const nextPatch: any = {};
    for (const [k, v] of Object.entries(event.payload.patch ?? {})) {
      if (hasOwn(locked, k)) continue; // locked wins
      nextPatch[k] = v;
    }

    if (Object.keys(nextPatch).length === 0) return null;

    return {
      ...event,
      payload: {
        ...event.payload,
        patch: nextPatch
      }
    } as BoardEvent;
  }

  return event;
}

function reducer(state: WhiteboardState | null, action: WhiteboardAction): WhiteboardState | null {
  switch (action.type) {
    case 'RESET_BOARD':
      return action.state;

    case 'APPLY_EVENT': {
      if (!state) return state;

      const boardTypeDef = getBoardType(state.meta.boardType);
      const enforcedEvent = enforcePolicyOnEvent(boardTypeDef, state, action.event);
      if (!enforcedEvent) return state;

      const history = ensureHistory(state);
      const applied = applyEvent(state, enforcedEvent);

      // We don't want viewport/selection-only changes to affect undo/redo history.
      if (enforcedEvent.type === 'viewportChanged' || enforcedEvent.type === 'selectionChanged') {
        return {
          ...applied,
          history
        };
      }

      return {
        ...applied,
        history: {
          pastEvents: [...history.pastEvents, enforcedEvent],
          futureEvents: [],
          baseline: history.baseline,
        }
      };
    }


    case 'APPLY_REMOTE_EVENT': {
      if (!state) return state;

      // Remote events are applied without affecting local undo/redo history.
      const boardTypeDef = getBoardType(state.meta.boardType);
      const enforcedEvent = enforcePolicyOnEvent(boardTypeDef, state, action.event);
      if (!enforcedEvent) return state;

      const history = ensureHistory(state);
      const applied = applyEvent(state, enforcedEvent);
      return { ...applied, history };
    }


    case 'UNDO': {
      if (!state) return state;
      const history = ensureHistory(state);
      if (history.pastEvents.length === 0) return state;

      const newFuture = [history.pastEvents[history.pastEvents.length - 1], ...history.futureEvents];
      const remainingPast = history.pastEvents.slice(0, -1);

      const rebuilt = rebuildStateFromHistory(state.meta, remainingPast, history.baseline);
      // Viewport changes are not tracked in history; keep current viewport stable across undo.
      return {
        ...rebuilt,
        viewport: state.viewport,
        history: {
          pastEvents: remainingPast,
          futureEvents: newFuture,
          baseline: history.baseline,
        }
      };
    }

    case 'REDO': {
      if (!state) return state;
      const history = ensureHistory(state);
      if (history.futureEvents.length === 0) return state;

      const [next, ...restFuture] = history.futureEvents;
      const boardTypeDef = getBoardType(state.meta.boardType);
      const enforcedNext = enforcePolicyOnEvent(boardTypeDef, state, next) ?? null;
      if (!enforcedNext) {
        // No-op redo: drop it from future events.
        return {
          ...state,
          history: {
            pastEvents: history.pastEvents,
            futureEvents: restFuture,
            baseline: history.baseline,
          }
        };
      }
      const applied = applyEvent(state, enforcedNext);

      // Again, viewport changes are not tracked in history
      if (enforcedNext.type === 'viewportChanged') {
        return {
          ...applied,
          history: {
            pastEvents: history.pastEvents,
            futureEvents: restFuture,
            baseline: history.baseline,
          }
        };
      }

      return {
        ...applied,
        history: {
          pastEvents: [...history.pastEvents, enforcedNext],
          futureEvents: restFuture,
          baseline: history.baseline,
        }
      };
    }


    case 'APPLY_TRANSIENT_OBJECT_PATCH': {
      if (!state) return state;

      const target = state.objects.find((o) => o.id === action.objectId);
      if (!target) return state;

      const boardTypeDef = getBoardType(state.meta.boardType);
      const locked = getLockedObjectProps(boardTypeDef, target.type);

      let patch: Partial<WhiteboardObject> = action.patch ?? {};
      if (locked && Object.keys(locked).length > 0) {
        const nextPatch: any = {};
        for (const [k, v] of Object.entries(patch)) {
          if (hasOwn(locked, k)) continue;
          nextPatch[k] = v;
        }
        if (Object.keys(nextPatch).length === 0) return state;
        patch = nextPatch;
      }

      return {
        ...state,
        objects: state.objects.map((o) => (o.id === action.objectId ? { ...o, ...patch } : o)),
      };
    }

    case 'SET_VIEWPORT': {
      if (!state) return state;
      return {
        ...state,
        viewport: {
          ...state.viewport,
          ...action.patch
        }
      };
    }

    default:
      return state;
  }
}

export const WhiteboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, null as WhiteboardState | null);

  // Cross-board clipboard: stored separately from per-board state.
  const [clipboard, setClipboard] = useState<WhiteboardClipboardV1 | null>(() => {
    try {
      return getClipboardRepository().loadClipboard();
    } catch {
      return null;
    }
  });

  // Keep clipboard in sync with localStorage (best-effort).
  useEffect(() => {
    try {
      getClipboardRepository().saveClipboard(clipboard);
    } catch {
      // ignore
    }
  }, [clipboard]);

  // Persist the board when history/viewport changes.
  // IMPORTANT: transient drag/resize patches should not trigger persistence.
  useEffect(() => {
    if (!state) return;
    const repo = getWhiteboardRepository();
    repo.saveBoard(state.meta.id, state).catch((err) => {
      console.error('Failed to persist whiteboard state', err);
    });
  }, [
    state?.meta.id,
    state?.viewport?.offsetX,
    state?.viewport?.offsetY,
    state?.viewport?.zoom,
    state?.history?.pastEvents?.length,
    state?.history?.futureEvents?.length,
  ]);

  const dispatchEvent = (event: BoardEvent) => {
    dispatch({ type: 'APPLY_EVENT', event });
  };

  const applyRemoteEvent = (event: BoardEvent) => {
    dispatch({ type: 'APPLY_REMOTE_EVENT', event });
  };

  const applyTransientObjectPatch = (objectId: ObjectId, patch: Partial<WhiteboardObject>) => {
    dispatch({ type: 'APPLY_TRANSIENT_OBJECT_PATCH', objectId, patch });
  };

  const generateEventId = () => 'evt_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);

  const copySelectionToClipboard = () => {
    if (!state) return;
    const next = createClipboardFromSelection({
      boardId: state.meta.id,
      objects: state.objects,
      selectedIds: state.selectedObjectIds,
    });
    if (!next) return;
    // Reset pasteCount so subsequent pastes start at one offset step.
    setClipboard({ ...next, pasteCount: 0 });
  };

  const pasteFromClipboard = (args?: { canvasWidth?: number; canvasHeight?: number }) => {
    if (!state) return;
    if (!clipboard) return;

    const canvasWidth = args?.canvasWidth;
    const canvasHeight = args?.canvasHeight;

    const res = pasteClipboard({
      clipboard,
      targetBoardId: state.meta.id,
      viewport: state.viewport,
      canvasSize:
        typeof canvasWidth === 'number' && typeof canvasHeight === 'number'
          ? { width: canvasWidth, height: canvasHeight }
          : undefined,
      existingIds: state.objects.map((o) => o.id),
    });

    const now = new Date().toISOString();

    // Create all new objects.
    for (const obj of res.objects) {
      const ev: BoardEvent = {
        id: generateEventId(),
        boardId: state.meta.id,
        type: 'objectCreated',
        timestamp: now,
        payload: { object: obj },
      } as BoardEvent;
      dispatchEvent(ev);
    }

    // Select the pasted objects.
    const selEv: BoardEvent = {
      id: generateEventId(),
      boardId: state.meta.id,
      type: 'selectionChanged',
      timestamp: now,
      payload: { selectedIds: res.selectedIds },
    } as BoardEvent;
    dispatchEvent(selEv);

    // Persist updated pasteCount (for progressive offset on same-board paste).
    setClipboard(res.nextClipboard);
  };

  const clearClipboard = () => {
    setClipboard(null);
    try {
      getClipboardRepository().clearClipboard();
    } catch {
      // ignore
    }
  };

  const resetBoard = (metaOrState: WhiteboardMeta | WhiteboardState) => {
    if ((metaOrState as WhiteboardState).meta && (metaOrState as any).objects) {
      // Already a full state → use as-is
      dispatch({ type: 'RESET_BOARD', state: metaOrState as WhiteboardState });
    } else {
      const state = createEmptyWhiteboardState(metaOrState as WhiteboardMeta);
      dispatch({ type: 'RESET_BOARD', state });
    }
  };

  const undo = () => dispatch({ type: 'UNDO' });
  const redo = () => dispatch({ type: 'REDO' });
  const setViewport = (patch: Partial<Viewport>) => dispatch({ type: 'SET_VIEWPORT', patch });

  const value: WhiteboardContextValue = useMemo(
    () => ({
      state,
      clipboard,
      dispatchEvent,
      applyRemoteEvent,
      resetBoard,
      undo,
      redo,
      setViewport,
      applyTransientObjectPatch,
      copySelectionToClipboard,
      pasteFromClipboard,
      clearClipboard,
    }),
    [state, clipboard]
  );

  return <WhiteboardContext.Provider value={value}>{children}</WhiteboardContext.Provider>;
};

export function useWhiteboard(): WhiteboardContextValue {
  const ctx = useContext(WhiteboardContext);
  if (!ctx) {
    throw new Error('useWhiteboard must be used within a WhiteboardProvider');
  }
  return ctx;
}
