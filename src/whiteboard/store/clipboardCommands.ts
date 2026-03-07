import { createClipboardFromSelection, pasteClipboard } from '../clipboard';
import type { BoardEvent, WhiteboardClipboardV1, WhiteboardState } from '../../domain/types';
import { generateEventId } from './providerUtils';

export function copySelectionToClipboardData(state: WhiteboardState): WhiteboardClipboardV1 | null {
  const next = createClipboardFromSelection({
    boardId: state.meta.id,
    objects: state.objects,
    selectedIds: state.selectedObjectIds,
  });
  return next ? { ...next, pasteCount: 0 } : null;
}

export function pasteClipboardAsEvents(
  state: WhiteboardState,
  clipboard: WhiteboardClipboardV1,
  args?: { canvasWidth?: number; canvasHeight?: number },
): { events: BoardEvent[]; nextClipboard: WhiteboardClipboardV1 } {
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

  const timestamp = new Date().toISOString();
  const events: BoardEvent[] = result.objects.map((object) => ({
    id: generateEventId(),
    boardId: state.meta.id,
    type: 'objectCreated',
    timestamp,
    payload: { object },
  }));

  events.push({
    id: generateEventId(),
    boardId: state.meta.id,
    type: 'selectionChanged',
    timestamp,
    payload: { selectedIds: result.selectedIds },
  });

  return {
    events,
    nextClipboard: result.nextClipboard,
  };
}
