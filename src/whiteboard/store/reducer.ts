import { applyEvent } from '../../domain/whiteboardState';
import type { WhiteboardState } from '../../domain/types';
import { getBoardType } from '../boardTypes';
import { ensureHistory, rebuildStateFromHistory } from './history';
import { enforcePolicyOnEvent, filterLockedObjectPatch } from './policy';
import type { WhiteboardAction } from './types';

export function whiteboardReducer(
  state: WhiteboardState | null,
  action: WhiteboardAction,
): WhiteboardState | null {
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

      if (enforcedEvent.type === 'viewportChanged' || enforcedEvent.type === 'selectionChanged') {
        return {
          ...applied,
          history,
        };
      }

      return {
        ...applied,
        history: {
          pastEvents: [...history.pastEvents, enforcedEvent],
          futureEvents: [],
          baseline: history.baseline,
        },
      };
    }

    case 'APPLY_REMOTE_EVENT': {
      if (!state) return state;

      const boardTypeDef = getBoardType(state.meta.boardType);
      const enforcedEvent = enforcePolicyOnEvent(boardTypeDef, state, action.event);
      if (!enforcedEvent) return state;

      const history = ensureHistory(state);
      const applied = applyEvent(state, enforcedEvent);
      return { ...applied, history };
    }

    case 'UNDO': {
      if (!state) return state;
      const history = ensureHistory(state);
      if (history.pastEvents.length === 0) return state;

      const newFuture = [history.pastEvents[history.pastEvents.length - 1], ...history.futureEvents];
      const remainingPast = history.pastEvents.slice(0, -1);
      const rebuilt = rebuildStateFromHistory(state.meta, remainingPast, history.baseline);

      return {
        ...rebuilt,
        viewport: state.viewport,
        history: {
          pastEvents: remainingPast,
          futureEvents: newFuture,
          baseline: history.baseline,
        },
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
        return {
          ...state,
          history: {
            pastEvents: history.pastEvents,
            futureEvents: restFuture,
            baseline: history.baseline,
          },
        };
      }

      const applied = applyEvent(state, enforcedNext);
      if (enforcedNext.type === 'viewportChanged') {
        return {
          ...applied,
          history: {
            pastEvents: history.pastEvents,
            futureEvents: restFuture,
            baseline: history.baseline,
          },
        };
      }

      return {
        ...applied,
        history: {
          pastEvents: [...history.pastEvents, enforcedNext],
          futureEvents: restFuture,
          baseline: history.baseline,
        },
      };
    }

    case 'APPLY_TRANSIENT_OBJECT_PATCH': {
      if (!state) return state;

      const target = state.objects.find((candidate) => candidate.id === action.objectId);
      if (!target) return state;

      const boardTypeDef = getBoardType(state.meta.boardType);
      const patch = filterLockedObjectPatch(boardTypeDef, target, action.patch ?? {});
      if (!patch) return state;

      return {
        ...state,
        objects: state.objects.map((object) => (object.id === action.objectId ? { ...object, ...patch } : object)),
      };
    }

    case 'SET_VIEWPORT': {
      if (!state) return state;
      return {
        ...state,
        viewport: {
          ...state.viewport,
          ...action.patch,
        },
      };
    }

    default:
      return state;
  }
}
