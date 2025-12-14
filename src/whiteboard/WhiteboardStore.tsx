// src/whiteboard/WhiteboardStore.tsx
import React, {
  createContext,
  useContext,
  useMemo,
  useReducer,
  useEffect
} from 'react';
import { applyEvent, createEmptyWhiteboardState } from '../domain/whiteboardState';
import type { BoardEvent, WhiteboardMeta, WhiteboardState, Viewport } from '../domain/types';
import { getWhiteboardRepository } from '../infrastructure/localStorageWhiteboardRepository';
import { getBoardType, getLockedObjectProps } from './boardTypes';

type WhiteboardAction =
  | { type: 'RESET_BOARD'; state: WhiteboardState }
  | { type: 'APPLY_EVENT'; event: BoardEvent }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_VIEWPORT'; patch: Partial<Viewport> };

interface WhiteboardContextValue {
  state: WhiteboardState | null;
  dispatchEvent: (event: BoardEvent) => void;
  /**
   * Can be called with:
   * - WhiteboardMeta → creates a fresh empty board
   * - WhiteboardState → directly sets an already loaded board
   */
  resetBoard: (metaOrState: WhiteboardMeta | WhiteboardState) => void;
  undo: () => void;
  redo: () => void;
  setViewport: (patch: Partial<Viewport>) => void;
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
  return state.history;
}

/**
 * Rebuilds a whiteboard state from metadata and a list of past events.
 * Viewport will be whatever createEmptyWhiteboardState uses by default.
 */
function rebuildStateFromHistory(meta: WhiteboardMeta, pastEvents: BoardEvent[]): WhiteboardState {
  let state = createEmptyWhiteboardState(meta);
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
      futureEvents: []
    }
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

      // We don't want viewport-only changes to affect undo/redo history.
      if (enforcedEvent.type === 'viewportChanged') {
        return {
          ...applied,
          history
        };
      }

      return {
        ...applied,
        history: {
          pastEvents: [...history.pastEvents, enforcedEvent],
          futureEvents: []
        }
      };
    }

    case 'UNDO': {
      if (!state) return state;
      const history = ensureHistory(state);
      if (history.pastEvents.length === 0) return state;

      const newFuture = [history.pastEvents[history.pastEvents.length - 1], ...history.futureEvents];
      const remainingPast = history.pastEvents.slice(0, -1);

      const rebuilt = rebuildStateFromHistory(state.meta, remainingPast);
      return {
        ...rebuilt,
        history: {
          pastEvents: remainingPast,
          futureEvents: newFuture
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
            futureEvents: restFuture
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
            futureEvents: restFuture
          }
        };
      }

      return {
        ...applied,
        history: {
          pastEvents: [...history.pastEvents, enforcedNext],
          futureEvents: restFuture
        }
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

  // Persist the board whenever the state changes
  useEffect(() => {
    if (!state) return;
    const repo = getWhiteboardRepository();
    repo.saveBoard(state.meta.id, state).catch((err) => {
      console.error('Failed to persist whiteboard state', err);
    });
  }, [state]);

  const dispatchEvent = (event: BoardEvent) => {
    dispatch({ type: 'APPLY_EVENT', event });
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
      dispatchEvent,
      resetBoard,
      undo,
      redo,
      setViewport
    }),
    [state]
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
