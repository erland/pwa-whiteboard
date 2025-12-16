// src/whiteboard/__tests__/clipboard.test.ts
import type { WhiteboardObject, Viewport } from '../../domain/types';
import { createClipboardFromSelection, pasteClipboard } from '../clipboard';

describe('whiteboard/clipboard (Step 2)', () => {
  test('createClipboardFromSelection returns null for empty selection', () => {
    const objects: WhiteboardObject[] = [
      { id: 'r1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50 },
    ];

    const clip = createClipboardFromSelection({
      boardId: 'b1',
      objects,
      selectedIds: [],
      nowIso: '2025-01-01T00:00:00.000Z',
    });

    expect(clip).toBeNull();
  });

  test('paste into same board applies an offset that scales with zoom and remaps ids', () => {
    const objects: WhiteboardObject[] = [
      { id: 'r1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50, strokeColor: '#fff' },
    ];

    const clip = createClipboardFromSelection({
      boardId: 'b1',
      objects,
      selectedIds: ['r1'],
      nowIso: '2025-01-01T00:00:00.000Z',
    });
    expect(clip).not.toBeNull();
    if (!clip) throw new Error('expected clipboard');

    // Deterministic id generator
    const ids = ['n1', 'n2', 'n3'];
    let idx = 0;
    const gen = () => ids[idx++] as any;

    const viewport: Viewport = { offsetX: 0, offsetY: 0, zoom: 2 };

    const res = pasteClipboard({
      clipboard: clip,
      targetBoardId: 'b1',
      viewport,
      existingIds: ['r1'],
      offsetCanvasPx: 20,
      generateObjectId: gen,
    });

    expect(res.objects).toHaveLength(1);
    expect(res.selectedIds).toEqual(['n1']);
    expect(res.objects[0].id).toBe('n1');

    // zoom=2 -> 20px becomes 10 world units; first paste uses step=1
    expect(res.objects[0].x).toBeCloseTo(20);
    expect(res.objects[0].y).toBeCloseTo(30);

    // Original untouched
    expect(objects[0].id).toBe('r1');
    expect(objects[0].x).toBe(10);
    expect(objects[0].y).toBe(20);

    // Clipboard pasteCount increments for same-board paste
    expect(res.nextClipboard.pasteCount).toBe(1);
  });

  test('repeated paste steps the offset (pasteCount)', () => {
    const objects: WhiteboardObject[] = [
      { id: 'r1', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 },
    ];

    const clip0 = createClipboardFromSelection({
      boardId: 'b1',
      objects,
      selectedIds: ['r1'],
      nowIso: '2025-01-01T00:00:00.000Z',
    });
    if (!clip0) throw new Error('expected clipboard');

    const viewport: Viewport = { offsetX: 0, offsetY: 0, zoom: 1 };
    const gen = (() => {
      const ids = ['n1', 'n2', 'n3', 'n4'];
      let i = 0;
      return () => ids[i++] as any;
    })();

    const r1 = pasteClipboard({
      clipboard: clip0,
      targetBoardId: 'b1',
      viewport,
      existingIds: ['r1'],
      offsetCanvasPx: 20,
      generateObjectId: gen,
    });
    expect(r1.objects[0].x).toBe(20);
    expect(r1.objects[0].y).toBe(20);

    const r2 = pasteClipboard({
      clipboard: r1.nextClipboard,
      targetBoardId: 'b1',
      viewport,
      existingIds: ['r1', ...r1.selectedIds],
      offsetCanvasPx: 20,
      generateObjectId: gen,
    });
    // second paste should step to 40,40
    expect(r2.objects[0].x).toBe(40);
    expect(r2.objects[0].y).toBe(40);
    expect(r2.nextClipboard.pasteCount).toBe(2);
  });

  test('paste into another board centers the clipboard bounds in the canvas', () => {
    const objects: WhiteboardObject[] = [
      { id: 'r1', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 },
    ];

    const clip = createClipboardFromSelection({
      boardId: 'b1',
      objects,
      selectedIds: ['r1'],
      nowIso: '2025-01-01T00:00:00.000Z',
    });
    if (!clip) throw new Error('expected clipboard');

    const viewport: Viewport = { offsetX: 0, offsetY: 0, zoom: 1 };
    const gen = (() => {
      const ids = ['n1'];
      let i = 0;
      return () => ids[i++] as any;
    })();

    const res = pasteClipboard({
      clipboard: clip,
      targetBoardId: 'b2',
      viewport,
      canvasSize: { width: 100, height: 100 },
      existingIds: [],
      generateObjectId: gen,
    });

    // original bounds center is (5,5). canvas center world is (50,50) => translate by (45,45)
    expect(res.objects).toHaveLength(1);
    expect(res.objects[0].x).toBeCloseTo(45);
    expect(res.objects[0].y).toBeCloseTo(45);
    // pasteCount does not increment on cross-board pastes
    expect(res.nextClipboard.pasteCount).toBe(0);
  });

  test('connector endpoints are remapped when both endpoint objects are in the clipboard', () => {
    const objects: WhiteboardObject[] = [
      { id: 'a', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 },
      { id: 'b', type: 'rectangle', x: 40, y: 0, width: 10, height: 10 },
      {
        id: 'c',
        type: 'connector',
        x: 0,
        y: 0,
        from: { objectId: 'a', attachment: { type: 'fallback', anchor: 'center' } },
        to: { objectId: 'b', attachment: { type: 'fallback', anchor: 'center' } },
        routing: 'straight',
      },
    ];

    const clip = createClipboardFromSelection({
      boardId: 'b1',
      objects,
      selectedIds: ['a', 'b', 'c'],
      nowIso: '2025-01-01T00:00:00.000Z',
    });
    if (!clip) throw new Error('expected clipboard');

    const viewport: Viewport = { offsetX: 0, offsetY: 0, zoom: 1 };
    const gen = (() => {
      const ids = ['na', 'nb', 'nc'];
      let i = 0;
      return () => ids[i++] as any;
    })();

    const res = pasteClipboard({
      clipboard: clip,
      targetBoardId: 'b2',
      viewport,
      canvasSize: { width: 100, height: 100 },
      existingIds: [],
      generateObjectId: gen,
    });

    expect(res.objects).toHaveLength(3);

    const pastedA = res.objects.find((o) => o.id === 'na')!;
    const pastedB = res.objects.find((o) => o.id === 'nb')!;
    const pastedC = res.objects.find((o) => o.id === 'nc')!;
    expect(pastedA).toBeTruthy();
    expect(pastedB).toBeTruthy();
    expect(pastedC).toBeTruthy();

    expect(pastedC.type).toBe('connector');
    expect(pastedC.from?.objectId).toBe('na');
    expect(pastedC.to?.objectId).toBe('nb');

    // Selection should include all pasted ids
    expect(new Set(res.selectedIds)).toEqual(new Set(['na', 'nb', 'nc']));
  });

  test('cross-board paste skips connectors that reference outside the clipboard', () => {
    const objects: WhiteboardObject[] = [
      { id: 'a', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 },
      { id: 'b', type: 'rectangle', x: 40, y: 0, width: 10, height: 10 },
      {
        id: 'c',
        type: 'connector',
        x: 0,
        y: 0,
        from: { objectId: 'a', attachment: { type: 'fallback', anchor: 'center' } },
        to: { objectId: 'b', attachment: { type: 'fallback', anchor: 'center' } },
        routing: 'straight',
      },
    ];

    const clip = createClipboardFromSelection({
      boardId: 'b1',
      objects,
      selectedIds: ['c'],
      nowIso: '2025-01-01T00:00:00.000Z',
    });
    if (!clip) throw new Error('expected clipboard');

    const viewport: Viewport = { offsetX: 0, offsetY: 0, zoom: 1 };
    const gen = (() => {
      const ids = ['nc'];
      let i = 0;
      return () => ids[i++] as any;
    })();

    const res = pasteClipboard({
      clipboard: clip,
      targetBoardId: 'b2',
      viewport,
      canvasSize: { width: 100, height: 100 },
      existingIds: [],
      generateObjectId: gen,
    });

    expect(res.objects).toHaveLength(0);
    expect(res.selectedIds).toHaveLength(0);
  });
});
