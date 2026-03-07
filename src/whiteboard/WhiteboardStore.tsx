// src/whiteboard/WhiteboardStore.tsx
import React, {
  createContext,
  useContext,
  useMemo,
  useReducer,
  useEffect,
  useState,
} from 'react';
import { createEmptyWhiteboardState } from '../domain/whiteboardState';
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
import { createClipboardFromSelection, pasteClipboard } from './clipboard';
import { whiteboardReducer } from './store';

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

function loadInitialClipboard(): WhiteboardClipboardV1 | null {
  try {
    return getClipboardRepository().loadClipboard();
  } catch {
    return null;
  }
}

function persistClipboard(clipboard: WhiteboardClipboardV1 | null) {
  try {
    getClipboardRepository().saveClipboard(clipboard);
  } catch {
    // ignore
  }
}

function generateEventId(): string {
  return `evt_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function toBoardState(metaOrState: WhiteboardMeta | WhiteboardState): WhiteboardState {
  if ((metaOrState as WhiteboardState).meta && (metaOrState as any).objects) {
    return metaOrState as WhiteboardState;
  }
  return createEmptyWhiteboardState(metaOrState as WhiteboardMeta);
}

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
    const next = createClipboardFromSelection({
      boardId: state.meta.id,
      objects: state.objects,
      selectedIds: state.selectedObjectIds,
    });
    if (!next) return;
    setClipboard({ ...next, pasteCount: 0 });
  };

  const pasteFromClipboard = (args?: { canvasWidth?: number; canvasHeight?: number }) => {
    if (!state || !clipboard) return;

    const canvasWidth = args?.canvasWidth;
    const canvasHeight = args?.canvasHeight;

    const result = pasteClipboard({
      clipboard,
      targetBoardId: state.meta.id,
      viewport: state.viewport,
      canvasSize:
        typeof canvasWidth === 'number' && typeof canvasHeight === 'number'
          ? { width: canvasWidth, height: canvasHeight }
          : undefined,
      existingIds: state.objects.map((object) => object.id),
    });

    const now = new Date().toISOString();

    for (const object of result.objects) {
      dispatchEvent({
        id: generateEventId(),
        boardId: state.meta.id,
        type: 'objectCreated',
        timestamp: now,
        payload: { object },
      } as BoardEvent);
    }

    dispatchEvent({
      id: generateEventId(),
      boardId: state.meta.id,
      type: 'selectionChanged',
      timestamp: now,
      payload: { selectedIds: result.selectedIds },
    } as BoardEvent);

    setClipboard(result.nextClipboard);
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
