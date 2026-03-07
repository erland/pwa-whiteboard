import type { Point } from '../../../domain/types';
import { getBoundingBox, hitTest, hitTestResizeHandleCanvas } from '../../geometry';
import type { Bounds } from '../../geometry';
import { canResizeObject } from '../../tools/shapeRegistry';
import { getCommitFromDrag, handleDragMove } from '../drag/dispatch';
import { cloneObj, getConnectorEndpointHit, getLineEndpointHit, minimizePatch } from './utils';
import type { CanvasInteractionsDeps } from './types';

export function handleSelectPointerDown(
  deps: CanvasInteractionsDeps,
  pos: Point,
  canvasX: number,
  canvasY: number
): boolean {
  if (deps.activeTool !== 'select') return false;

  if (deps.selectedObjectIds.length === 1) {
    const selectedId = deps.selectedObjectIds[0];
    const selectedObj = deps.objects.find((o) => o.id === selectedId);

    if (selectedObj && canResizeObject(selectedObj)) {
      const box = getBoundingBox(selectedObj);
      if (box) {
        const handleId = hitTestResizeHandleCanvas(canvasX, canvasY, box as Bounds, deps.viewport);
        if (handleId) {
          deps.setDrag({
            kind: 'resize',
            objectId: selectedId,
            handle: handleId,
            startX: pos.x,
            startY: pos.y,
            originalBounds: {
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
            },
            originalObject: cloneObj(selectedObj),
            lastPatch: null,
          });
          return true;
        }
      }
    }
  }

  const hitObj = hitTest(deps.objects, pos.x, pos.y);
  if (hitObj) {
    if (hitObj.type === 'line') {
      deps.onSelectionChange([hitObj.id]);

      const endpoint = getLineEndpointHit(hitObj, deps.viewport, canvasX, canvasY);
      if (endpoint) {
        deps.setDrag({
          kind: 'lineEndpoint',
          objectId: hitObj.id,
          endpoint,
          originalObject: cloneObj(hitObj),
          lastPatch: null,
        });
        return true;
      }

      deps.setDrag({
        kind: 'move',
        objectId: hitObj.id,
        startX: pos.x,
        startY: pos.y,
        originalObject: cloneObj(hitObj),
        lastPatch: null,
      });
      return true;
    }

    if (hitObj.type === 'connector') {
      deps.onSelectionChange([hitObj.id]);

      const endpoint = getConnectorEndpointHit(hitObj, deps.objects, deps.viewport, canvasX, canvasY);
      if (endpoint) {
        deps.setDrag({
          kind: 'connectorEndpoint',
          objectId: hitObj.id,
          endpoint,
          originalObject: cloneObj(hitObj),
          lastPatch: null,
        });
      }
      return true;
    }

    deps.onSelectionChange([hitObj.id]);
    deps.setDrag({
      kind: 'move',
      objectId: hitObj.id,
      startX: pos.x,
      startY: pos.y,
      originalObject: cloneObj(hitObj),
      lastPatch: null,
    });
    return true;
  }

  deps.onSelectionChange([]);
  deps.setDrag({
    kind: 'pan',
    startCanvasX: canvasX,
    startCanvasY: canvasY,
    startOffsetX: deps.viewport.offsetX ?? 0,
    startOffsetY: deps.viewport.offsetY ?? 0,
    zoomAtStart: deps.viewport.zoom ?? 1,
  });
  return true;
}

export function handleSelectPointerMove(
  deps: CanvasInteractionsDeps,
  pos: Point,
  canvasX: number,
  canvasY: number
): boolean {
  if (!deps.drag || deps.activeTool !== 'select') return false;

  const next = handleDragMove(deps.drag, {
    objects: deps.objects,
    viewport: deps.viewport,
    pos,
    canvasX,
    canvasY,
    onTransientObjectPatch: deps.onTransientObjectPatch,
    onViewportChange: deps.onViewportChange,
  });

  if (next !== deps.drag) deps.setDrag(next);
  return true;
}

export function finishSelectInteraction(deps: CanvasInteractionsDeps): boolean {
  if (!deps.drag || deps.activeTool !== 'select') return false;

  const commit = getCommitFromDrag(deps.drag, minimizePatch);
  if (commit) deps.onUpdateObject(commit.objectId, commit.patch);
  deps.setDrag(null);
  return true;
}
