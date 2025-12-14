// src/whiteboard/tools/_shared/resizeByBounds.ts
import type { WhiteboardObject } from '../../../domain/types';
import type { Bounds } from '../../geometry/types';

/**
 * Default resize behavior for axis-aligned box-based objects.
 * Applies the resized bounds directly to x/y/width/height.
 */
export function resizeBoxObjectByBounds(
  _obj: WhiteboardObject,
  newBounds: Bounds
): Partial<WhiteboardObject> {
  return {
    x: newBounds.x,
    y: newBounds.y,
    width: newBounds.width,
    height: newBounds.height,
  };
}
