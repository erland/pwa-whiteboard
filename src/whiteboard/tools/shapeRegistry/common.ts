import type { WhiteboardObject } from '../../../domain/types';
import type { SelectionCapabilities } from '../selection/types';

export const EMPTY_SELECTION_CAPS: SelectionCapabilities = { editableProps: [] };

export function applyOptionalStringProp<T extends WhiteboardObject>(
  object: T,
  key: keyof T,
  value: unknown
): T {
  return typeof value === 'string' ? ({ ...object, [key]: value } as T) : object;
}

export function applyOptionalNumberProp<T extends WhiteboardObject>(
  object: T,
  key: keyof T,
  value: unknown
): T {
  return typeof value === 'number' ? ({ ...object, [key]: value } as T) : object;
}
