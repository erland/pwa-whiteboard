// src/whiteboard/WhiteboardStore.tsx
import React, {
  createContext,
  useContext,
  useMemo,
  useReducer,
  useEffect,
  useState,
} from 'react';
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
import {
  clearPersistedClipboard,
  copySelectionToClipboardData,
  loadInitialClipboard,
  pasteClipboardAsEvents,
  persistClipboard,
  toBoardState,
  whiteboardReducer,
} from './store';

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

export const WhiteboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(whiteboardReducer, null as WhiteboardState | null);
  const [clipboard, setClipboard] = useState<WhiteboardClipboardV1 | null>(loadInitialClipboard);

  useEffect(() => {
    persistClipboard(clipboard);
  }, [clipboard]);

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

  const copySelectionToClipboard = () => {
    if (!state) return;
    const next = copySelectionToClipboardData(state);
    if (!next) return;
    setClipboard(next);
  };

  const pasteFromClipboard = (args?: { canvasWidth?: number; canvasHeight?: number }) => {
    if (!state || !clipboard) return;

    const result = pasteClipboardAsEvents(state, clipboard, args);
    for (const event of result.events) dispatchEvent(event);
    setClipboard(result.nextClipboard);
  };

  const clearClipboard = () => {
    setClipboard(null);
    clearPersistedClipboard();
  };

  const resetBoard = (metaOrState: WhiteboardMeta | WhiteboardState) => {
    dispatch({ type: 'RESET_BOARD', state: toBoardState(metaOrState) });
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
