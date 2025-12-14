// src/pages/boardEditor/useSelectionDetails.ts
import type { WhiteboardObject } from '../../domain/types';
import type { BoardTypeDefinition } from '../../whiteboard/boardTypes';
import {
  getCommonEditableProps,
  getSharedPropValue,
  type EditablePropKey,
} from '../../whiteboard/tools/selectionRegistry';
import {
  getHiddenSelectionPropKeys,
  getLockedEditableKeys,
  getLockedObjectProps,
} from '../../whiteboard/boardTypes';

export type SelectionDetails = {
  selectedCount: number;

  isSingleTextSelected: boolean;
  isSingleStickySelected: boolean;
  isSingleConnectorSelected: boolean;

  singleSelectedObject?: WhiteboardObject; // text or sticky
  singleConnectorObject?: WhiteboardObject; // connector

  isAllTextSelection: boolean;
  isAllConnectorSelection: boolean;

  /**
   * Capability-driven selection fields.
   * - commonEditableProps: intersection of editable props across selected objects
   * - sharedEditableValues: shared values for those props (only set when all selected objects have same value)
   */
  commonEditableProps: EditablePropKey[];
  sharedEditableValues: Partial<Record<EditablePropKey, unknown>>;

  /** Keys that are hidden by the board type policy (union across selected object types). */
  hiddenEditableProps: EditablePropKey[];
  /** Keys that are locked by the board type policy (union across selected object types). */
  lockedEditableProps: EditablePropKey[];

  /** Convenience: single selected object (any type). */
  singleAnySelectedObject?: WhiteboardObject;
};

export function useSelectionDetails(
  selectedObjects: WhiteboardObject[],
  boardTypeDef?: BoardTypeDefinition
): SelectionDetails {
  const selectedCount = selectedObjects.length;

  const singleAnySelectedObject = selectedCount === 1 ? selectedObjects[0] : undefined;

  const isSingleTextSelected =
    selectedCount === 1 && selectedObjects[0].type === 'text';
  const isSingleStickySelected =
    selectedCount === 1 && selectedObjects[0].type === 'stickyNote';
  const isSingleConnectorSelected =
    selectedCount === 1 && selectedObjects[0].type === 'connector';

  const singleSelectedObject =
    isSingleTextSelected || isSingleStickySelected ? selectedObjects[0] : undefined;

  const singleConnectorObject =
    isSingleConnectorSelected ? selectedObjects[0] : undefined;

  const isAllTextSelection =
    selectedCount > 0 && selectedObjects.every((obj) => obj.type === 'text');

  const isAllConnectorSelection =
    selectedCount > 0 && selectedObjects.every((obj) => obj.type === 'connector');

  const rawCommonEditableProps = getCommonEditableProps(selectedObjects);

  // Apply board type policy (hidden/locked). For multi-selection, we take the union across selected types.
  const hiddenSet = new Set<EditablePropKey>();
  const lockedSet = new Set<EditablePropKey>();
  if (boardTypeDef && selectedCount > 0) {
    for (const obj of selectedObjects) {
      getHiddenSelectionPropKeys(boardTypeDef, obj.type).forEach((k) => hiddenSet.add(k));
      const locked = getLockedObjectProps(boardTypeDef, obj.type);
      getLockedEditableKeys(locked).forEach((k) => lockedSet.add(k));
    }
  }

  const commonEditableProps = rawCommonEditableProps.filter(
    (k) => !hiddenSet.has(k) // hidden wins
  );
  const sharedEditableValues: Partial<Record<EditablePropKey, unknown>> = {};
  for (const key of commonEditableProps) {
    // NOTE: our editable prop keys are a subset of WhiteboardObject keys.
    // We only surface a control if all selected objects share the same value.
    sharedEditableValues[key] = getSharedPropValue(
      selectedObjects,
      key as keyof WhiteboardObject
    );
  }

  return {
    selectedCount,
    isSingleTextSelected,
    isSingleStickySelected,
    isSingleConnectorSelected,
    singleSelectedObject,
    singleConnectorObject,
    singleAnySelectedObject,
    isAllTextSelection,
    isAllConnectorSelection,
    commonEditableProps,
    sharedEditableValues,
    hiddenEditableProps: Array.from(hiddenSet),
    lockedEditableProps: Array.from(lockedSet)
  };
}