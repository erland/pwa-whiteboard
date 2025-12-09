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
  for (const ev of pastEvents) {
    state = applyEvent(state, ev);
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

function reducer(state: WhiteboardState | null, action: WhiteboardAction): WhiteboardState | null {
  switch (action.type) {
    case 'RESET_BOARD':
      return action.state;

    case 'APPLY_EVENT': {
      if (!state) return state;

      const history = ensureHistory(state);
      const applied = applyEvent(state, action.event);

      // We don't want viewport-only changes to affect undo/redo history.
      if (action.event.type === 'viewportChanged') {
        return {
          ...applied,
          history
        };
      }

      return {
        ...applied,
        history: {
          pastEvents: [...history.pastEvents, action.event],
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
      const applied = applyEvent(state, next);

      // Again, viewport changes are not tracked in history
      if (next.type === 'viewportChanged') {
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
          pastEvents: [...history.pastEvents, next],
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
