// src/whiteboard/tools/selection/types.ts

/**
 * Shared selection-capability types used by tool modules.
 *
 * Intentionally kept free of imports from selectionRegistry to avoid circular deps.
 */

export type EditablePropKey =
  | 'strokeColor'
  | 'strokeWidth'
  | 'fillColor'
  | 'textColor'
  | 'fontSize'
  | 'text';

export type SelectionCapabilities = {
  /**
   * Which properties are editable when selecting this object type.
   * Selection UI will only show controls for properties shared across the selection.
   */
  editableProps: readonly EditablePropKey[];
};
