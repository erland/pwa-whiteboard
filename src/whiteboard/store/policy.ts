import type { BoardEvent, WhiteboardObject, WhiteboardState } from '../../domain/types';
import { getBoardType, getLockedObjectProps } from '../boardTypes';

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function filterLockedObjectPatch(
  boardTypeDef: ReturnType<typeof getBoardType>,
  target: WhiteboardObject,
  patch: Partial<WhiteboardObject>,
): Partial<WhiteboardObject> | null {
  const locked = getLockedObjectProps(boardTypeDef, target.type);
  if (!locked || Object.keys(locked).length === 0) return patch;

  const nextPatch: Partial<WhiteboardObject> = {};
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (hasOwn(locked, key)) continue;
    (nextPatch as any)[key] = value;
  }

  return Object.keys(nextPatch).length > 0 ? nextPatch : null;
}

export function enforcePolicyOnEvent(
  boardTypeDef: ReturnType<typeof getBoardType>,
  state: WhiteboardState,
  event: BoardEvent,
): BoardEvent | null {
  if (event.type === 'objectCreated') {
    const object = event.payload.object;
    const locked = getLockedObjectProps(boardTypeDef, object.type);
    if (!locked || Object.keys(locked).length === 0) return event;

    return {
      ...event,
      payload: {
        ...event.payload,
        object: {
          ...object,
          ...locked,
        },
      },
    } as BoardEvent;
  }

  if (event.type === 'objectUpdated') {
    const target = state.objects.find((candidate) => candidate.id === event.payload.objectId);
    if (!target) return event;

    const nextPatch = filterLockedObjectPatch(boardTypeDef, target, event.payload.patch ?? {});
    if (!nextPatch) return null;

    return {
      ...event,
      payload: {
        ...event.payload,
        patch: nextPatch,
      },
    } as BoardEvent;
  }

  return event;
}
