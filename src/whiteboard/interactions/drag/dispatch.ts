// src/whiteboard/interactions/drag/dispatch.ts
import type { Attachment, Point, Viewport, WhiteboardObject } from '../../../domain/types';
import {
  hitTestConnectable,
  isConnectable,
  resizeBounds,
} from '../../geometry';
import { pickAttachmentForObject } from '../../tools/connector/interactions';
import {
  resizeObject,
  translateObject,
} from '../../tools/shapeRegistry';
import type { DragCommit, DragState } from './types';

export type DragMoveDeps = {
  objects: WhiteboardObject[];
  viewport: Viewport;
  pos: Point; // world coords
  canvasX: number; // canvas coords
  canvasY: number;
  onTransientObjectPatch: (objectId: string, patch: Partial<WhiteboardObject>) => void;
  onViewportChange: (patch: Partial<Viewport>) => void;
};

/**
 * Applies a pointer-move update for the current drag state.
 *
 * Returns the (possibly) updated drag state (e.g., to store lastPatch),
 * or the original drag state if no update was needed.
 */
export function handleDragMove(drag: DragState, deps: DragMoveDeps): DragState {
  const { objects, viewport, pos, canvasX, canvasY, onTransientObjectPatch, onViewportChange } = deps;

  if (drag.kind === 'lineEndpoint') {
    const line = objects.find((o) => o.id === drag.objectId);
    if (!line || line.type !== 'line') return drag;

    const patch =
      drag.endpoint === 'start'
        ? ({ x: pos.x, y: pos.y } as Partial<WhiteboardObject>)
        : ({ x2: pos.x, y2: pos.y } as Partial<WhiteboardObject>);

    onTransientObjectPatch(line.id, patch);
    return { ...drag, lastPatch: patch };
  }

  if (drag.kind === 'connectorEndpoint') {
    const connector = objects.find((o) => o.id === drag.objectId);
    if (!connector || connector.type !== 'connector') return drag;

    // Prefer re-attaching to the connectable object currently under pointer.
    const hoverObj = hitTestConnectable(objects, pos.x, pos.y);

    // Otherwise, move along the currently attached object (if still present).
    const attachedId = drag.endpoint === 'from' ? connector.from?.objectId : connector.to?.objectId;
    const attachedObj = attachedId ? objects.find((o) => o.id === attachedId) : undefined;

    const targetObj = hoverObj ?? (attachedObj && isConnectable(attachedObj) ? attachedObj : null);
    if (!targetObj) return drag;

    // Allow continuous anchor motion (edgeT/perimeterAngle) while still supporting ports.
    const newAttachment: Attachment = pickAttachmentForObject(targetObj, pos, viewport);

    const patch =
      drag.endpoint === 'from'
        ? ({ from: { objectId: targetObj.id, attachment: newAttachment } } as Partial<WhiteboardObject>)
        : ({ to: { objectId: targetObj.id, attachment: newAttachment } } as Partial<WhiteboardObject>);

    onTransientObjectPatch(connector.id, patch);
    return { ...drag, lastPatch: patch };
  }

  if (drag.kind === 'move') {
    const dx = pos.x - drag.startX;
    const dy = pos.y - drag.startY;
    if (dx === 0 && dy === 0) return drag;

    const patch = translateObject(drag.originalObject, dx, dy);

    // If a shape opts out of moving (e.g., semantic connectors), don't emit patches.
    if (!patch) return drag;

    onTransientObjectPatch(drag.objectId, patch);
    return { ...drag, lastPatch: patch };
  }

  if (drag.kind === 'pan') {
    const dxCanvas = canvasX - drag.startCanvasX;
    const dyCanvas = canvasY - drag.startCanvasY;
    const zoom = drag.zoomAtStart || 1;

    onViewportChange({
      offsetX: drag.startOffsetX + dxCanvas / zoom,
      offsetY: drag.startOffsetY + dyCanvas / zoom,
    });

    return drag;
  }

  // resize
  const dx = pos.x - drag.startX;
  const dy = pos.y - drag.startY;
  const newBounds = resizeBounds(drag.originalBounds, drag.handle, dx, dy);

  const patch = resizeObject(drag.originalObject, newBounds);
  if (patch) {
    onTransientObjectPatch(drag.objectId, patch);
    return { ...drag, lastPatch: patch };
  }

  return drag;
}

export type MinimizePatchFn = (
  original: any,
  patch: Record<string, any>
) => Record<string, any> | null;

/**
 * Produces an undo-worthy patch for the completed drag, if any.
 * (Pan has no object patch to commit.)
 */
export function getCommitFromDrag(drag: DragState, minimizePatch: MinimizePatchFn): DragCommit | null {
  if (drag.kind === 'pan') return null;

  const patch = (drag as any).lastPatch ?? null;
  if (!patch) return null;

  const minimized = minimizePatch((drag as any).originalObject, patch as any);
  if (!minimized) return null;

  return { objectId: (drag as any).objectId, patch: minimized as any };
}
