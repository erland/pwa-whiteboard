import { toolPointerDown, toolPointerMove, toolPointerUp, canResizeObject, translateObject } from '../tools/shapeRegistry';
import type { WhiteboardObject, Viewport } from '../../domain/types';

const viewport: Viewport = { offsetX: 0, offsetY: 0, zoom: 1 };

function makeCtx() {
  let counter = 0;
  return {
    objects: [] as WhiteboardObject[],
    viewport,
    strokeColor: '#112233',
    strokeWidth: 3,
    toolProps: { fillColor: '#ffeeaa', text: 'Remember this', textColor: '#223344', fontSize: 20 },
    generateObjectId: () => `obj-${++counter}` as any,
  };
}

describe('shapeRegistry refactor safety net', () => {
  test('sticky note click-create keeps tool defaults wired through the registry', () => {
    const res = toolPointerDown('stickyNote', makeCtx(), { x: 40, y: 50 });
    expect(res.kind).toBe('create');
    if (res.kind !== 'create') throw new Error('expected click-create result');
    expect(res.object.type).toBe('stickyNote');
    expect(res.object.id).toBe('obj-1');
    expect(res.object.x).toBe(40);
    expect(res.object.y).toBe(50);
    expect(res.object.fillColor).toBe('#ffeeaa');
    expect(res.object.text).toBe('Remember this');
    expect(res.selectIds).toEqual(['obj-1']);
  });

  test('rectangle drag draft is updated and committed through registry dispatch', () => {
    const ctx = makeCtx();
    const down = toolPointerDown('rectangle', ctx, { x: 10, y: 20 });
    expect(down.kind).toBe('draft');
    if (down.kind !== 'draft') throw new Error('expected draft result');
    const moved = toolPointerMove(down.draft, ctx, { x: 60, y: 90 });
    const up = toolPointerUp(moved.draft, ctx, { x: 60, y: 90 });
    expect(up.kind).toBe('create');
    if (up.kind !== 'create') throw new Error('expected create result');
    expect(up.object).toMatchObject({ id: 'obj-1', type: 'rectangle', x: 10, y: 20, width: 50, height: 70, strokeColor: '#112233', strokeWidth: 3 });
  });

  test('registry helpers preserve special-case geometry rules', () => {
    expect(canResizeObject({ id: 'r1', type: 'rectangle', x: 0, y: 0, width: 10, height: 20 })).toBe(true);
    expect(canResizeObject({ id: 'c1', type: 'connector', x: 0, y: 0 })).toBe(false);
    expect(translateObject({ id: 'c1', type: 'connector', x: 0, y: 0 }, 10, 20)).toBeNull();
    expect(translateObject({ id: 'r1', type: 'rectangle', x: 1, y: 2, width: 10, height: 20 }, 10, 20)).toEqual({ x: 11, y: 22 });
  });
});
