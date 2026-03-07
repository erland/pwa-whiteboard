import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';

import type { BoardEvent, WhiteboardState } from '../../domain/types';
import { WhiteboardProvider, useWhiteboard } from '../WhiteboardStore';
import { createEmptyWhiteboardState } from '../../domain/whiteboardState';

const saveBoardMock = jest.fn(() => Promise.resolve());

jest.mock('../../infrastructure/localStorageWhiteboardRepository', () => ({
  getWhiteboardRepository: () => ({
    saveBoard: saveBoardMock as any,
  }),
}));

function Harness() {
  const wb = useWhiteboard();
  return (
    <div>
      <button onClick={() => {
        const base = createEmptyWhiteboardState({ id: 'board-1', name: 'Board 1', boardType: 'advanced', createdAt: '2026-03-07T00:00:00.000Z', updatedAt: '2026-03-07T00:00:00.000Z' });
        const loaded: WhiteboardState = { ...base, objects: [{ id: 'rect-1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50, strokeColor: '#111111' }], selectedObjectIds: ['rect-1'], history: undefined as any };
        wb.resetBoard(loaded);
      }}>load-advanced</button>
      <button onClick={() => {
        const base = createEmptyWhiteboardState({ id: 'board-mindmap', name: 'Mindmap', boardType: 'mindmap', createdAt: '2026-03-07T00:00:00.000Z', updatedAt: '2026-03-07T00:00:00.000Z' });
        wb.resetBoard(base);
      }}>load-mindmap</button>
      <button onClick={() => {
        const ev: BoardEvent = { id: 'ev-update-1', boardId: 'board-1', type: 'objectUpdated', timestamp: '2026-03-07T00:01:00.000Z', payload: { objectId: 'rect-1', patch: { width: 140 } } };
        wb.dispatchEvent(ev);
      }}>update-width</button>
      <button onClick={() => wb.undo()}>undo</button>
      <button onClick={() => wb.redo()}>redo</button>
      <button onClick={() => {
        const ev: BoardEvent = { id: 'ev-create-1', boardId: 'board-mindmap', type: 'objectCreated', timestamp: '2026-03-07T00:02:00.000Z', payload: { object: { id: 'sticky-1', type: 'stickyNote', x: 0, y: 0, width: 200, height: 140, fillColor: '#ffffff', strokeColor: '#ff0000', textColor: '#00ff00', text: 'hello' } } };
        wb.dispatchEvent(ev);
      }}>create-sticky</button>
      <button onClick={() => wb.applyTransientObjectPatch('sticky-1', { fillColor: '#123456', textColor: '#abcdef', x: 25 })}>transient-patch</button>
      <output data-testid="state-json">{JSON.stringify(wb.state)}</output>
    </div>
  );
}

describe('WhiteboardStore refactor safety net', () => {
  beforeEach(() => {
    saveBoardMock.mockClear();
    localStorage.clear();
  });

  test('undo/redo rebuilds from a loaded baseline snapshot without losing preloaded objects', async () => {
    render(<WhiteboardProvider><Harness /></WhiteboardProvider>);
    act(() => { screen.getByText('load-advanced').click(); });
    act(() => { screen.getByText('update-width').click(); });

    let state = JSON.parse(screen.getByTestId('state-json').textContent || 'null');
    expect(state.objects[0].width).toBe(140);
    expect(state.history.pastEvents).toHaveLength(1);

    act(() => { screen.getByText('undo').click(); });
    state = JSON.parse(screen.getByTestId('state-json').textContent || 'null');
    expect(state.objects[0].id).toBe('rect-1');
    expect(state.objects[0].width).toBe(100);
    expect(state.history.pastEvents).toHaveLength(0);
    expect(state.history.futureEvents).toHaveLength(1);

    act(() => { screen.getByText('redo').click(); });
    state = JSON.parse(screen.getByTestId('state-json').textContent || 'null');
    expect(state.objects[0].width).toBe(140);
    expect(state.history.pastEvents).toHaveLength(1);
    expect(state.history.futureEvents).toHaveLength(0);
    await waitFor(() => expect(saveBoardMock).toHaveBeenCalled());
  });

  test('mindmap policy locks sticky-note styling for created and transiently updated objects', () => {
    render(<WhiteboardProvider><Harness /></WhiteboardProvider>);
    act(() => { screen.getByText('load-mindmap').click(); });
    act(() => { screen.getByText('create-sticky').click(); });

    let state = JSON.parse(screen.getByTestId('state-json').textContent || 'null');
    expect(state.objects[0].fillColor).toBe('#fef08a');
    expect(state.objects[0].strokeColor).toBe('#0f172a');
    expect(state.objects[0].textColor).toBe('#0f172a');

    act(() => { screen.getByText('transient-patch').click(); });
    state = JSON.parse(screen.getByTestId('state-json').textContent || 'null');
    expect(state.objects[0].x).toBe(25);
    expect(state.objects[0].fillColor).toBe('#fef08a');
    expect(state.objects[0].textColor).toBe('#0f172a');
  });
});
