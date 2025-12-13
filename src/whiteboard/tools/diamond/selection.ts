// src/whiteboard/tools/diamond/selection.ts
import type { SelectionCapabilities } from '../selection/types';

export const diamondSelectionCapabilities: SelectionCapabilities = {
  editableProps: ['strokeColor', 'strokeWidth', 'fillColor'] as const,
};
