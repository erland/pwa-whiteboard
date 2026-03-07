import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { WhiteboardObject } from '../../domain/types';
import { useCanvasInteractions } from '../useCanvasInteractions';

function Harness(props: { activeTool: any; objects?: WhiteboardObject[]; selectedObjectIds?: string[]; onCreateObject?: jest.Mock; onSelectionChange?: jest.Mock; onUpdateObject?: jest.Mock; onTransientObjectPatch?: jest.Mock; onViewportChange?: jest.Mock; }) {
  const interactions = useCanvasInteractions({
    objects: props.objects ?? [],
    selectedObjectIds: props.selectedObjectIds ?? [],
    viewport: { offsetX: 0, offsetY: 0, zoom: 1 },
    activeTool: props.activeTool,
    strokeColor: '#111111',
    strokeWidth: 2,
    toolProps: { fillColor: '#ffeeaa', text: 'Hook text' },
    onCreateObject: props.onCreateObject ?? jest.fn(),
    onSelectionChange: props.onSelectionChange ?? jest.fn(),
    onUpdateObject: props.onUpdateObject ?? jest.fn(),
    onTransientObjectPatch: props.onTransientObjectPatch ?? jest.fn(),
    onViewportChange: props.onViewportChange ?? jest.fn(),
    canvasWidth: 800,
    canvasHeight: 600,
  });

  return <canvas data-testid="canvas" width={800} height={600} ref={(el) => { if (!el) return; Object.defineProperty(el, 'getBoundingClientRect', { configurable: true, value: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }) }); }} onPointerDown={interactions.handlePointerDown} onPointerMove={interactions.handlePointerMove} onPointerUp={interactions.handlePointerUp} onPointerLeave={interactions.handlePointerLeave} />;
}

describe('useCanvasInteractions refactor safety net', () => {
  test('delegates sticky-note click create via the hook', () => {
    const onCreateObject = jest.fn();
    const onSelectionChange = jest.fn();
    render(<Harness activeTool="stickyNote" onCreateObject={onCreateObject} onSelectionChange={onSelectionChange} />);
    fireEvent.pointerDown(screen.getByTestId('canvas'), { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 120, clientY: 140 });
    expect(onCreateObject).toHaveBeenCalledTimes(1);
    const created = onCreateObject.mock.calls[0][0];
    expect(created.type).toBe('stickyNote');
    expect(created.fillColor).toBe('#ffeeaa');
    expect(onSelectionChange).toHaveBeenCalledWith([created.id]);
  });

  test('select mode starts a pan gesture on empty-canvas drag', () => {
    const onSelectionChange = jest.fn();
    const onViewportChange = jest.fn();
    render(<Harness activeTool="select" onSelectionChange={onSelectionChange} onViewportChange={onViewportChange} />);
    fireEvent.pointerDown(screen.getByTestId('canvas'), { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 50, clientY: 60 });
    fireEvent.pointerMove(screen.getByTestId('canvas'), { pointerId: 2, pointerType: 'mouse', clientX: 80, clientY: 90 });
    expect(onSelectionChange).toHaveBeenCalledWith([]);
    expect(onViewportChange).toHaveBeenCalled();
  });
});
