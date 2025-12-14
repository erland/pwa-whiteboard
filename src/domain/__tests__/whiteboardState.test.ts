import { applyEvent, createEmptyWhiteboardState } from '../whiteboardState';
import type { BoardEvent, WhiteboardMeta, WhiteboardObject } from '../types';

function makeMeta(): WhiteboardMeta {
  const now = new Date().toISOString();
  return {
    id: 'test-board',
    name: 'Test Board',
    boardType: 'advanced',
    createdAt: now,
    updatedAt: now
  };
}

function makeEvent(base: Partial<BoardEvent>): BoardEvent {
  return {
    id: 'evt-1',
    boardId: 'test-board',
    timestamp: new Date().toISOString(),
    type: base.type as BoardEvent['type'],
    payload: (base as any).payload
  } as BoardEvent;
}

describe('whiteboardState.applyEvent', () => {
  it('adds a created object', () => {
    const meta = makeMeta();
    const state = createEmptyWhiteboardState(meta);
    const obj: WhiteboardObject = {
      id: 'obj-1',
      type: 'rectangle',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      strokeColor: '#fff'
    };

    const event = makeEvent({
      type: 'objectCreated',
      payload: { object: obj }
    });

    const next = applyEvent(state, event);
    expect(next.objects).toHaveLength(1);
    expect(next.objects[0]).toMatchObject({ id: 'obj-1', x: 10, y: 20 });
  });

  it('updates an existing object', () => {
    const meta = makeMeta();
    const initial = createEmptyWhiteboardState(meta);
    const obj: WhiteboardObject = {
      id: 'obj-1',
      type: 'rectangle',
      x: 10,
      y: 20,
      width: 100,
      height: 50
    };
    const created = applyEvent(initial, makeEvent({
      type: 'objectCreated',
      payload: { object: obj }
    }));

    const updated = applyEvent(created, makeEvent({
      type: 'objectUpdated',
      payload: { objectId: 'obj-1', patch: { x: 30 } }
    }));

    expect(updated.objects[0].x).toBe(30);
  });

  it('deletes an object and clears selection', () => {
    const meta = makeMeta();
    const initial = createEmptyWhiteboardState(meta);
    const obj: WhiteboardObject = {
      id: 'obj-1',
      type: 'rectangle',
      x: 10,
      y: 20
    };
    const created = applyEvent(initial, makeEvent({
      type: 'objectCreated',
      payload: { object: obj }
    }));

    const selected = applyEvent(created, makeEvent({
      type: 'selectionChanged',
      payload: { selectedIds: ['obj-1'] }
    }));

    const deleted = applyEvent(selected, makeEvent({
      type: 'objectDeleted',
      payload: { objectId: 'obj-1' }
    }));

    expect(deleted.objects).toHaveLength(0);
    expect(deleted.selectedObjectIds).toHaveLength(0);
  });
});
