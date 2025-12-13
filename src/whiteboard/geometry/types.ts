// src/whiteboard/geometry/types.ts

/**
 * Shared geometry types.
 *
 * Tool-specific geometry modules import from here to avoid importing
 * `src/whiteboard/geometry.ts` directly (which imports tool modules).
 */

export type ResizeHandleId =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w';

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};
