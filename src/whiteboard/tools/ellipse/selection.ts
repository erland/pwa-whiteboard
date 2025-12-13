// src/whiteboard/tools/ellipse/selection.ts

import type { SelectionCapabilities } from '../selection/types';

export const ellipseSelectionCapabilities: SelectionCapabilities = {
  editableProps: ['strokeColor', 'strokeWidth', 'fillColor'] as const,
};
