// src/whiteboard/tools/rectangle/selection.ts

import type { SelectionCapabilities } from '../selection/types';

export const rectangleSelectionCapabilities: SelectionCapabilities = {
  editableProps: ['strokeColor', 'strokeWidth', 'fillColor'] as const,
};
