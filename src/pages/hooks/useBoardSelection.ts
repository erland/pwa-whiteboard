// src/pages/hooks/useBoardSelection.ts
import type { WhiteboardMeta, WhiteboardObject, BoardEvent } from '../../domain/types';
import { generateEventId } from './boardEvents';

type WhiteboardStateForSelection = {
  meta: WhiteboardMeta;
  objects: WhiteboardObject[];
  selectedObjectIds: string[];
};

type UseBoardSelectionArgs = {
  state: (WhiteboardStateForSelection & { history?: any }) | null;
  dispatchEvent: (event: BoardEvent) => void;
};

export function useBoardSelection({ state, dispatchEvent }: UseBoardSelectionArgs) {
  const selectedObjects: WhiteboardObject[] =
    state && state.selectedObjectIds.length > 0
      ? state.objects.filter((obj) => state.selectedObjectIds.includes(obj.id))
      : [];

  const handleSelectionChange = (selectedIds: string[]) => {
    if (!state) return;
    const now = new Date().toISOString();
    const event: BoardEvent = {
      id: generateEventId(),
      boardId: state.meta.id,
      type: 'selectionChanged',
      timestamp: now,
      payload: { selectedIds }
    } as BoardEvent;
    dispatchEvent(event);
  };

  const handleDeleteSelection = () => {
    if (!state || state.selectedObjectIds.length === 0) return;
    const count = state.selectedObjectIds.length;
    const confirmed = window.confirm(
      `Delete ${count} selected object${count === 1 ? '' : 's'}? This cannot be undone.`
    );
    if (!confirmed) return;

    const now = new Date().toISOString();
    // Delete each selected object
    state.selectedObjectIds.forEach((objectId) => {
      const event: BoardEvent = {
        id: generateEventId(),
        boardId: state.meta.id,
        type: 'objectDeleted',
        timestamp: now,
        payload: { objectId }
      } as BoardEvent;
      dispatchEvent(event);
    });

    // Clear selection after delete
    const clearEvent: BoardEvent = {
      id: generateEventId(),
      boardId: state.meta.id,
      type: 'selectionChanged',
      timestamp: new Date().toISOString(),
      payload: { selectedIds: [] }
    } as BoardEvent;
    dispatchEvent(clearEvent);
  };

  const updateSelectionProp: <K extends keyof WhiteboardObject>(
    key: K,
    value: WhiteboardObject[K]
  ) => void = (key, value) => {
    if (!state || selectedObjects.length === 0) return;
    const now = new Date().toISOString();
    selectedObjects.forEach((obj) => {
      const event: BoardEvent = {
        id: generateEventId(),
        boardId: state.meta.id,
        type: 'objectUpdated',
        timestamp: now,
        payload: {
          objectId: obj.id,
          patch: { [key]: value } as Partial<WhiteboardObject>
        }
      } as BoardEvent;
      dispatchEvent(event);
    });
  };

  return {
    selectedObjects,
    handleSelectionChange,
    handleDeleteSelection,
    updateSelectionProp
  };
}