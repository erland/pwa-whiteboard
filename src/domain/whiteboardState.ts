import {
  BoardEvent,
  ObjectId,
  WhiteboardMeta,
  WhiteboardObject,
  WhiteboardState,
  Viewport
} from './types';

/**
 * Helper to create an empty whiteboard state from metadata.
 */
export function createEmptyWhiteboardState(meta: WhiteboardMeta): WhiteboardState {
  return {
    meta,
    objects: [],
    selectedObjectIds: [],
    viewport: defaultViewport(),
    history: {
      pastEvents: [],
      futureEvents: []
    }
  };
}

export function defaultViewport(): Viewport {
  return {
    offsetX: 0,
    offsetY: 0,
    zoom: 1
  };
}

/**
 * Pure function that applies a single event to the given state and returns a new state.
 * History stacks are *not* updated here; they will be handled by a higher-level store.
 */
export function applyEvent(state: WhiteboardState, event: BoardEvent): WhiteboardState {
  switch (event.type) {
    case 'objectCreated':
      return {
        ...state,
        objects: [...state.objects, event.payload.object]
      };

    case 'objectUpdated':
      return {
        ...state,
        objects: state.objects.map((obj) =>
          obj.id === event.payload.objectId
            ? { ...obj, ...event.payload.patch }
            : obj
        )
      };

    case 'objectDeleted':
      return {
        ...state,
        objects: state.objects.filter((obj) => obj.id !== event.payload.objectId),
        selectedObjectIds: state.selectedObjectIds.filter(
          (id) => id !== event.payload.objectId
        )
      };

    case 'selectionChanged':
      return {
        ...state,
        selectedObjectIds: [...event.payload.selectedIds]
      };

    case 'viewportChanged':
      return {
        ...state,
        viewport: {
          ...state.viewport,
          ...event.payload.viewport
        }
      };

    default:
      // Exhaustiveness check
      return state;
  }
}

/**
 * Convenience helper to look up an object by id.
 */
export function getObjectById(state: WhiteboardState, id: ObjectId): WhiteboardObject | undefined {
  return state.objects.find((o) => o.id === id);
}
