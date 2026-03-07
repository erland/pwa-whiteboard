import { createEmptyWhiteboardState } from '../../domain/whiteboardState';
import type { WhiteboardState } from '../../domain/types';
import { copySelectionToClipboardData, pasteClipboardAsEvents, toBoardState } from '../store';

function createState(): WhiteboardState {
  return {
    ...createEmptyWhiteboardState({
      id: 'board-1',
      name: 'Board 1',
      boardType: 'advanced',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
    objects: [
      {
        id: 'rect-1',
        type: 'rectangle',
        x: 10,
        y: 20,
        width: 100,
        height: 80,
      },
    ],
    selectedObjectIds: ['rect-1'],
  };
}

describe('whiteboard store consolidation helpers', () => {
  it('coerces metadata into an empty board state', () => {
    const state = toBoardState({
      id: 'board-1',
      name: 'Board 1',
      boardType: 'advanced',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(state.meta.id).toBe('board-1');
    expect(state.objects).toEqual([]);
  });

  it('creates a persisted clipboard payload from the current selection', () => {
    const clipboard = copySelectionToClipboardData(createState());
    expect(clipboard).not.toBeNull();
    expect(clipboard?.pasteCount).toBe(0);
    expect(clipboard?.objects).toHaveLength(1);
    expect(clipboard?.objects[0].id).toBe('rect-1');
  });

  it('turns a paste operation into object-created and selection-changed events', () => {
    const state = createState();
    const clipboard = copySelectionToClipboardData(state);
    expect(clipboard).not.toBeNull();

    const result = pasteClipboardAsEvents(state, clipboard!, { canvasWidth: 800, canvasHeight: 600 });

    expect(result.events).toHaveLength(2);
    expect(result.events[0].type).toBe('objectCreated');
    expect(result.events[1].type).toBe('selectionChanged');
    expect(result.nextClipboard.pasteCount).toBe(1);
  });
});
