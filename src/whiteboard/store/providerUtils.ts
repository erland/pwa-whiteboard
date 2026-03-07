import { createEmptyWhiteboardState } from '../../domain/whiteboardState';
import type { WhiteboardClipboardV1, WhiteboardMeta, WhiteboardState } from '../../domain/types';
import { getClipboardRepository } from '../../infrastructure/localStorageClipboardRepository';

export function isWhiteboardState(value: WhiteboardMeta | WhiteboardState): value is WhiteboardState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'meta' in value &&
    'objects' in value &&
    Array.isArray((value as WhiteboardState).objects)
  );
}

export function toBoardState(metaOrState: WhiteboardMeta | WhiteboardState): WhiteboardState {
  return isWhiteboardState(metaOrState) ? metaOrState : createEmptyWhiteboardState(metaOrState);
}

export function loadInitialClipboard(): WhiteboardClipboardV1 | null {
  try {
    return getClipboardRepository().loadClipboard();
  } catch {
    return null;
  }
}

export function persistClipboard(clipboard: WhiteboardClipboardV1 | null): void {
  try {
    getClipboardRepository().saveClipboard(clipboard);
  } catch {
    // ignore persistence failures for best-effort clipboard storage
  }
}

export function clearPersistedClipboard(): void {
  try {
    getClipboardRepository().clearClipboard();
  } catch {
    // ignore persistence failures for best-effort clipboard storage
  }
}

export function generateEventId(): string {
  return `evt_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}
