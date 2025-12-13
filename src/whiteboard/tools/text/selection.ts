// src/whiteboard/tools/text/selection.ts

import type { SelectionCapabilities } from '../selection/types';

export const textSelectionCapabilities: SelectionCapabilities = {
  editableProps: ['textColor', 'fontSize', 'text'] as const,
};
