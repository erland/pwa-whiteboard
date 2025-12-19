import { applyEvent, createEmptyWhiteboardState } from '../index';
import type { BoardEvent } from '../types';

describe('shared/domain determinism', () => {
  it('applies the same ordered events to produce the same final state', () => {
    const meta = {
      id: 'b-1',
      name: 'Board',
      boardType: 'advanced',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z'
    } as const;

    const base = createEmptyWhiteboardState(meta);

    const events: BoardEvent[] = [
      {
        id: 'e1',
        boardId: 'b-1',
        type: 'objectCreated',
        timestamp: '2025-01-01T00:00:01.000Z',
        payload: {
          object: {
            id: 'o1',
            type: 'rectangle',
            x: 10,
            y: 20,
            width: 100,
            height: 80,
            rotation: 0,
            strokeColor: '#000000',
            strokeWidth: 2,
            fillColor: 'transparent',
            cornerRadius: 0
          }
        }
      },
      {
        id: 'e2',
        boardId: 'b-1',
        type: 'objectUpdated',
        timestamp: '2025-01-01T00:00:02.000Z',
        payload: {
          objectId: 'o1',
          patch: { x: 50, y: 60 }
        }
      },
      {
        id: 'e3',
        boardId: 'b-1',
        type: 'objectCreated',
        timestamp: '2025-01-01T00:00:03.000Z',
        payload: {
          object: {
            id: 'o2',
            type: 'text',
            x: 5,
            y: 5,
            width: 200,
            height: 40,
            rotation: 0,
            text: 'Hello',
            fontSize: 18,
            textColor: '#111111'
          }
        }
      }
    ];

    const s1 = events.reduce((st, ev) => applyEvent(st, ev), base);
    const s2 = events.reduce((st, ev) => applyEvent(st, ev), base);

    expect(s1).toEqual(s2);
    expect(s1.objects.map((o) => o.id).sort()).toEqual(['o1', 'o2']);
  });
});
