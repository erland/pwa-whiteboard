// src/pages/hooks/useBoardMutations.ts
import { generateEventId } from './boardEvents';
import type { BoardEvent, WhiteboardObject } from '../../domain/types';

export type UseBoardMutationsArgs = {
  state: { meta: { id: string } } | null;
  dispatchEvent: (event: BoardEvent) => void;
  applyTransientObjectPatch: (objectId: string, patch: Partial<WhiteboardObject>) => void;
};

export function useBoardMutations({
  state,
  dispatchEvent,
  applyTransientObjectPatch,
}: UseBoardMutationsArgs) {
  const handleCreateObject = (object: WhiteboardObject) => {
    if (!state) return;
    const now = new Date().toISOString();
    const event: BoardEvent = {
      id: generateEventId(),
      boardId: state.meta.id,
      type: 'objectCreated',
      timestamp: now,
      payload: { object },
    } as BoardEvent;
    dispatchEvent(event);
  };

  const handleTransientObjectPatch = (objectId: string, patch: Partial<WhiteboardObject>) => {
    // Apply live interaction patches without creating undo/redo history.
    applyTransientObjectPatch(objectId as any, patch);
  };

  const handleUpdateObject = (objectId: string, patch: Partial<WhiteboardObject>) => {
    if (!state) return;
    const now = new Date().toISOString();
    const event: BoardEvent = {
      id: generateEventId(),
      boardId: state.meta.id,
      type: 'objectUpdated',
      timestamp: now,
      payload: { objectId, patch },
    } as BoardEvent;
    dispatchEvent(event);
  };

  return {
    handleCreateObject,
    handleUpdateObject,
    handleTransientObjectPatch,
  };
}
