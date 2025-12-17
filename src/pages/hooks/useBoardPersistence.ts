// src/pages/hooks/useBoardPersistence.ts
import { useEffect } from 'react';
import type { WhiteboardMeta, WhiteboardState, WhiteboardObject } from '../../domain/types';
import { getWhiteboardRepository } from '../../infrastructure/localStorageWhiteboardRepository';
import { getBoardsRepository } from '../../infrastructure/localStorageBoardsRepository';
import {
  getBoardType,
  getLockedObjectProps,
} from '../../whiteboard/boardTypes';

export type UseBoardPersistenceArgs = {
  id: string | undefined;
  state: WhiteboardState | null;
  resetBoard: (next: WhiteboardMeta | WhiteboardState) => void;
};

export function useBoardPersistence({ id, state, resetBoard }: UseBoardPersistenceArgs) {
  // ---- Board loading / initialization ----
  useEffect(() => {
    if (!id) return;

    // If we already have the correct board loaded, do nothing.
    if (state && state.meta.id === id) {
      return;
    }

    let cancelled = false;
    const repo = getWhiteboardRepository();
    const boardsRepo = getBoardsRepository();

    (async () => {
      try {
        const existing = await repo.loadBoard(id);
        if (cancelled) return;

        if (existing) {
          // Load persisted state
          resetBoard(existing);
          return;
        }

        // No persisted state found → create a fresh board
        const index = await boardsRepo.listBoards();
        const indexMeta = index.find((m) => m.id === id) ?? null;

        const now = new Date().toISOString();
        const meta: WhiteboardMeta = {
          id,
          name: indexMeta?.name ?? 'Untitled board',
          boardType: indexMeta?.boardType ?? 'advanced',
          createdAt: indexMeta?.createdAt ?? now,
          updatedAt: now,
        };

        resetBoard(meta);
      } catch (err) {
        console.error('Failed to load board state', err);

        try {
          // Best-effort: still try to respect the index name in the error path
          const index = await boardsRepo.listBoards();
          const indexMeta = index.find((m) => m.id === id) ?? null;

          const now = new Date().toISOString();
          const meta: WhiteboardMeta = {
            id,
            name: indexMeta?.name ?? 'Untitled board',
            boardType: indexMeta?.boardType ?? 'advanced',
            createdAt: indexMeta?.createdAt ?? now,
            updatedAt: now,
          };

          if (!cancelled) {
            resetBoard(meta);
          }
        } catch {
          // Absolute fallback if even the index fails
          if (!cancelled) {
            const now = new Date().toISOString();
            const meta: WhiteboardMeta = {
              id,
              name: 'Untitled board',
              boardType: 'advanced',
              createdAt: now,
              updatedAt: now,
            };
            resetBoard(meta);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, state?.meta?.id, resetBoard]);

  // ---- Board type changes ----
  const setBoardType = async (nextType: WhiteboardMeta['boardType']) => {
    if (!state) return;
    if (state.meta.boardType === nextType) return;

    const now = new Date().toISOString();
    const nextBoardTypeDef = getBoardType(nextType);

    // Apply locked object props immediately so the board becomes consistent with the new type.
    const nextObjects = state.objects.map((o: WhiteboardObject) => {
      const locked = getLockedObjectProps(nextBoardTypeDef, o.type);
      if (!locked || Object.keys(locked).length === 0) return o;
      return { ...o, ...locked };
    });

    // Update the boards index so the list page shows the new type.
    try {
      const boardsRepo = getBoardsRepository();
      await boardsRepo.setBoardType(state.meta.id, nextType);
    } catch (err) {
      console.error('Failed to persist boardType to boards index', err);
    }

    // Update in-memory state + persisted board state.
    resetBoard({
      ...state,
      meta: {
        ...state.meta,
        boardType: nextType,
        updatedAt: now,
      },
      objects: nextObjects,
    });
  };

  return {
    setBoardType,
  };
}
