// src/whiteboard/tools/_shared/selectionCaps.ts
//
// Shared selection capability presets to avoid repeating editable prop lists.

import type { SelectionCapabilities } from '../selection/types';

export const STROKE_ONLY: SelectionCapabilities = {
  editableProps: ['strokeColor', 'strokeWidth'] as const,
};

export const BOX_WITH_FILL: SelectionCapabilities = {
  editableProps: ['strokeColor', 'strokeWidth', 'fillColor'] as const,
};

export const TEXT_ONLY: SelectionCapabilities = {
  editableProps: ['textColor', 'fontSize', 'text'] as const,
};

export const STICKY_NOTE: SelectionCapabilities = {
  editableProps: ['strokeColor', 'strokeWidth', 'fillColor', 'textColor', 'fontSize', 'text'] as const,
};
