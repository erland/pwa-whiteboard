// src/whiteboard/tools/line/selection.ts

import type { SelectionCapabilities } from '../selection/types';

export const lineSelectionCapabilities: SelectionCapabilities = {
  editableProps: ['strokeColor', 'strokeWidth', 'arrowStart', 'arrowEnd'] as const,
};
