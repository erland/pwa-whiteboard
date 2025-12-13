// src/pages/boardEditor/useSelectionDetails.ts
import type { WhiteboardObject } from '../../domain/types';

function getSharedProp<K extends keyof WhiteboardObject>(
  objects: WhiteboardObject[],
  key: K
): WhiteboardObject[K] | undefined {
  if (objects.length === 0) return undefined;
  const first = objects[0][key];
  if (first === undefined) return undefined;

  for (const obj of objects) {
    if (obj[key] !== first) return undefined;
  }
  return first;
}

export type SelectionDetails = {
  selectedCount: number;

  isSingleTextSelected: boolean;
  isSingleStickySelected: boolean;
  isSingleConnectorSelected: boolean;

  singleSelectedObject?: WhiteboardObject; // text or sticky
  singleConnectorObject?: WhiteboardObject; // connector

  isAllTextSelection: boolean;
  isAllConnectorSelection: boolean;

  sharedStrokeColor?: string;
  sharedStrokeWidth?: number;
  sharedFillColor?: string;
  sharedFontSize?: number;
  sharedText?: string;
  sharedTextColor?: string;
};

export function useSelectionDetails(
  selectedObjects: WhiteboardObject[]
): SelectionDetails {
  const selectedCount = selectedObjects.length;

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

  const sharedStrokeColor = getSharedProp(selectedObjects, 'strokeColor') as
    | string
    | undefined;

  const sharedStrokeWidth = getSharedProp(selectedObjects, 'strokeWidth') as
    | number
    | undefined;

  const sharedFillColor = getSharedProp(selectedObjects, 'fillColor') as
    | string
    | undefined;

  const sharedFontSize = getSharedProp(selectedObjects, 'fontSize') as
    | number
    | undefined;

  const sharedText = getSharedProp(selectedObjects, 'text') as string | undefined;

  const sharedTextColor = getSharedProp(selectedObjects, 'textColor') as
    | string
    | undefined;

  return {
    selectedCount,
    isSingleTextSelected,
    isSingleStickySelected,
    isSingleConnectorSelected,
    singleSelectedObject,
    singleConnectorObject,
    isAllTextSelection,
    isAllConnectorSelection,
    sharedStrokeColor,
    sharedStrokeWidth,
    sharedFillColor,
    sharedFontSize,
    sharedText,
    sharedTextColor
  };
}