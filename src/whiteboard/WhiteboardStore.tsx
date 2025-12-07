import React, { createContext, useContext, useMemo, useReducer } from 'react';
import { applyEvent, createEmptyWhiteboardState } from '../domain/whiteboardState';
import type { BoardEvent, WhiteboardMeta, WhiteboardState, Viewport } from '../domain/types';

type WhiteboardAction =
  | { type: 'RESET_BOARD'; state: WhiteboardState }
  | { type: 'APPLY_EVENT'; event: BoardEvent }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_VIEWPORT'; patch: Partial<Viewport> };

interface WhiteboardContextValue {
  state: WhiteboardState | null;
  dispatchEvent: (event: BoardEvent) => void;
  resetBoard: (meta: WhiteboardMeta) => void;
  undo: () => void;
  redo: () => void;
  setViewport: (patch: Partial<Viewport>) => void;
}

const WhiteboardContext = createContext<WhiteboardContextValue | undefined>(undefined);

/**
 * Rebuilds a WhiteboardState from metadata and a list of past events.
 * History is reset to the provided events as past and empty future.
 * NOTE: This does NOT preserve the viewport – callers that care about the
 * current view should override `viewport` after calling this.
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

function whiteboardReducer(
  state: WhiteboardState | null,
  action: WhiteboardAction
): WhiteboardState | null {
  switch (action.type) {
    case 'RESET_BOARD':
      return action.state;

    case 'APPLY_EVENT': {
      if (!state) return state;

      const past = state.history.pastEvents;
      const newPast = [...past, action.event];

      // Apply the event on top of the current state so we preserve the viewport
      const applied = applyEvent(state, action.event);

      return {
        ...applied,
        history: {
          pastEvents: newPast,
          futureEvents: []
        }
      };
    }

    case 'UNDO': {
      if (!state) return state;

      const past = state.history.pastEvents;
      if (past.length === 0) return state;

      const future = state.history.futureEvents;
      const last = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);

      // Rebuild from shortened history, but keep the current viewport
      const currentViewport = state.viewport;
      const rebuilt = rebuildStateFromHistory(state.meta, newPast);

      return {
        ...rebuilt,
        viewport: currentViewport,
        history: {
          pastEvents: newPast,
          futureEvents: [...future, last]
        }
      };
    }

    case 'REDO': {
      if (!state) return state;

      const future = state.history.futureEvents;
      if (future.length === 0) return state;

      const past = state.history.pastEvents;
      const last = future[future.length - 1];
      const newFuture = future.slice(0, future.length - 1);
      const newPast = [...past, last];

      const currentViewport = state.viewport;
      const rebuilt = rebuildStateFromHistory(state.meta, newPast);

      return {
        ...rebuilt,
        viewport: currentViewport,
        history: {
          pastEvents: newPast,
          futureEvents: newFuture
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
  const [state, dispatch] = useReducer(whiteboardReducer, null);

  const value: WhiteboardContextValue = useMemo(
    () => ({
      state,
      dispatchEvent: (event: BoardEvent) => dispatch({ type: 'APPLY_EVENT', event }),
      resetBoard: (meta: WhiteboardMeta) =>
        dispatch({ type: 'RESET_BOARD', state: createEmptyWhiteboardState(meta) }),
      undo: () => dispatch({ type: 'UNDO' }),
      redo: () => dispatch({ type: 'REDO' }),
      setViewport: (patch: Partial<Viewport>) => dispatch({ type: 'SET_VIEWPORT', patch })
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