// src/pages/boardEditor/useSelectionDetails.ts
import type { WhiteboardObject } from '../../domain/types';
import {
  getCommonEditableProps,
  getSharedPropValue,
  type EditablePropKey,
} from '../../whiteboard/tools/selectionRegistry';

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

  /** Convenience: single selected object (any type). */
  singleAnySelectedObject?: WhiteboardObject;
};

export function useSelectionDetails(
  selectedObjects: WhiteboardObject[]
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

  const commonEditableProps = getCommonEditableProps(selectedObjects);
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
    sharedEditableValues
  };
}