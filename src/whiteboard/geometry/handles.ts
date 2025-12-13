// src/whiteboard/geometry/handles.ts

import type { Point } from '../../domain/types';
import type { Bounds, ResizeHandleId } from './types';

/**
 * Positions of the eight resize handles around a bounding box (in world coords).
 */
export function getHandlePositions(bounds: Bounds): Record<ResizeHandleId, Point> {
  const { x, y, width, height } = bounds;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const right = x + width;
  const bottom = y + height;

  return {
    nw: { x, y },
    n: { x: cx, y },
    ne: { x: right, y },
    e: { x: right, y: cy },
    se: { x: right, y: bottom },
    s: { x: cx, y: bottom },
    sw: { x, y: bottom },
    w: { x, y: cy }
  };
}

/**
 * Resize a bounding box given a handle and delta movement in world coords.
 */
export function resizeBounds(
  original: Bounds,
  handle: ResizeHandleId,
  dx: number,
  dy: number
): Bounds {
  const MIN_SIZE = 4;

  let { x, y, width, height } = original;

  // Horizontal adjustment
  switch (handle) {
    case 'e':
    case 'ne':
    case 'se': {
      width = Math.max(MIN_SIZE, original.width + dx);
      break;
    }
    case 'w':
    case 'nw':
    case 'sw': {
      const newWidth = Math.max(MIN_SIZE, original.width - dx);
      x = original.x + (original.width - newWidth);
      width = newWidth;
      break;
    }
    default:
      break;
  }

  // Vertical adjustment
  switch (handle) {
    case 's':
    case 'se':
    case 'sw': {
      height = Math.max(MIN_SIZE, original.height + dy);
      break;
    }
    case 'n':
    case 'ne':
    case 'nw': {
      const newHeight = Math.max(MIN_SIZE, original.height - dy);
      y = original.y + (original.height - newHeight);
      height = newHeight;
      break;
    }
    default:
      break;
  }

  return { x, y, width, height };
}
