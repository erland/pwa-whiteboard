// src/whiteboard/tools/freehand/selection.ts

import type { SelectionCapabilities } from '../selection/types';
import { STROKE_ONLY } from '../_shared/selectionCaps';

// Freehand supports editing stroke styling when selected.
export const freehandSelectionCapabilities: SelectionCapabilities = STROKE_ONLY;
