// src/whiteboard/tools/stickyNote/selection.ts

import type { SelectionCapabilities } from '../selection/types';

export const stickyNoteSelectionCapabilities: SelectionCapabilities = {
  editableProps: ['strokeColor', 'strokeWidth', 'fillColor', 'textColor', 'fontSize', 'text'] as const,
};
