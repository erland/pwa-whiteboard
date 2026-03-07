import type { WhiteboardState } from '../../domain/types';
import { createEmptyWhiteboardState } from '../../domain/whiteboardState';
import {
  isPersistedV2,
  packObjectsForStorage,
  persistedV2ToState,
  snapshotToPersistedV2,
  unpackObjectsFromStorage,
  asMeta,
  migrateLoadedState,
  tryRebuildFromHistory,
} from '../whiteboardPersistence';

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
        id: 'free-1',
        type: 'freehand',
        x: 0,
        y: 0,
        points: [
          { x: 1.2, y: 3.4 },
          { x: 5.6, y: 7.8 },
        ],
      },
    ],
  };
}

describe('whiteboardPersistence helpers', () => {
  it('packs and unpacks freehand points through the persisted snapshot codec', () => {
    const state = createState();

    const persisted = snapshotToPersistedV2('board-1', state);
    expect(isPersistedV2(persisted)).toBe(true);
    expect((persisted.objects[0] as any).points).toBeUndefined();
    expect(typeof (persisted.objects[0] as any).pointsPacked).toBe('string');

    const restored = persistedV2ToState('board-1', persisted);
    expect(restored.objects).toHaveLength(1);
    expect(restored.objects[0].type).toBe('freehand');
    expect(restored.objects[0].points).toEqual([
      { x: 1.2, y: 3.4 },
      { x: 5.6, y: 7.8 },
    ]);
  });

  it('keeps non-freehand objects unchanged when packing/unpacking', () => {
    const objects = [
      { id: 'rect-1', type: 'rectangle', x: 1, y: 2, width: 3, height: 4 },
    ];

    expect(packObjectsForStorage(objects as any[])).toEqual(objects);
    expect(unpackObjectsFromStorage(objects as any[])).toEqual(objects);
  });

  it('normalizes invalid boardType metadata when migrating a loaded state', () => {
    const state = createState();
    const migrated = migrateLoadedState({
      ...state,
      meta: {
        ...state.meta,
        boardType: 'not-a-board-type' as any,
      },
    });

    expect(migrated.meta.boardType).toBe('advanced');
  });

  it('rebuilds a board from history-only payloads', () => {
    const rebuilt = tryRebuildFromHistory('board-1', {
      meta: {
        name: 'Board 1',
        boardType: 'advanced',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      pastEvents: [
        {
          id: 'evt-1',
          boardId: 'board-1',
          type: 'objectCreated',
          timestamp: '2026-01-01T00:01:00.000Z',
          payload: {
            object: {
              id: 'rect-1',
              type: 'rectangle',
              x: 10,
              y: 20,
              width: 30,
              height: 40,
            },
          },
        },
      ],
      selectedObjectIds: ['rect-1'],
      viewport: { offsetX: 5, offsetY: 6, zoom: 2 },
    });

    expect(rebuilt).not.toBeNull();
    expect(rebuilt?.objects[0]?.id).toBe('rect-1');
    expect(rebuilt?.selectedObjectIds).toEqual(['rect-1']);
    expect(rebuilt?.viewport).toEqual({ offsetX: 5, offsetY: 6, zoom: 2 });
    expect(rebuilt?.history.pastEvents).toHaveLength(1);
    expect(rebuilt?.meta.updatedAt).toBe('2026-01-01T00:01:00.000Z');
  });

  it('creates normalized metadata defaults', () => {
    const meta = asMeta('board-1', { name: 'Board 1', boardType: 'freehand' });
    expect(meta.id).toBe('board-1');
    expect(meta.name).toBe('Board 1');
    expect(meta.boardType).toBe('freehand');
    expect(typeof meta.createdAt).toBe('string');
    expect(typeof meta.updatedAt).toBe('string');
  });
});
