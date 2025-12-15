// src/whiteboard/tools/connector/selection.ts

import type { SelectionCapabilities } from '../selection/types';

export const connectorSelectionCapabilities: SelectionCapabilities = {
  editableProps: ['strokeColor', 'strokeWidth', 'arrowStart', 'arrowEnd'] as const,
};
