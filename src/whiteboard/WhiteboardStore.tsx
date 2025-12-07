import React, { createContext, useContext, useReducer, useMemo } from 'react';
import { applyEvent, createEmptyWhiteboardState } from '../domain/whiteboardState';
import type { BoardEvent, WhiteboardMeta, WhiteboardState } from '../domain/types';

type WhiteboardAction =
  | { type: 'RESET_BOARD'; state: WhiteboardState }
  | { type: 'APPLY_EVENT'; event: BoardEvent };

interface WhiteboardContextValue {
  state: WhiteboardState | null;
  dispatchEvent: (event: BoardEvent) => void;
  resetBoard: (meta: WhiteboardMeta) => void;
}

const WhiteboardContext = createContext<WhiteboardContextValue | undefined>(undefined);

function whiteboardReducer(state: WhiteboardState | null, action: WhiteboardAction): WhiteboardState | null {
  switch (action.type) {
    case 'RESET_BOARD':
      return action.state;

    case 'APPLY_EVENT':
      if (!state) {
        // No board loaded – ignore for now
        return state;
      }
      // For now we only apply events and push them to pastEvents.
      const nextState = applyEvent(state, action.event);
      return {
        ...nextState,
        history: {
          ...state.history,
          pastEvents: [...state.history.pastEvents, action.event],
          futureEvents: []
        },
        meta: {
          ...state.meta,
          updatedAt: event.timestamp
        }
      };

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
        dispatch({ type: 'RESET_BOARD', state: createEmptyWhiteboardState(meta) })
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
