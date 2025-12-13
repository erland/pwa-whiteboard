// src/whiteboard/tools/selectionRegistry.ts

import type { WhiteboardObject, WhiteboardObjectType } from '../../domain/types';
import type { EditablePropKey, SelectionCapabilities } from './selection/types';

import { rectangleSelectionCapabilities } from './rectangle/selection';
import { ellipseSelectionCapabilities } from './ellipse/selection';
import { stickyNoteSelectionCapabilities } from './stickyNote/selection';
import { textSelectionCapabilities } from './text/selection';
import { connectorSelectionCapabilities } from './connector/selection';

/**
 * Selection UI capabilities.
 *
 * The selection panel should not hardcode which properties exist.
 * Instead, each object type declares which properties are editable when selected.
 *
 * Refinement: per-tool capabilities live in each tool folder (tools/<tool>/selection.ts).
 * This file only contains shared prop definitions + a simple registry map.
 */

export type { EditablePropKey, SelectionCapabilities };

export type PropControl =
  | { kind: 'color' }
  | { kind: 'range'; min: number; max: number; step: number }
  | { kind: 'text' }
  | { kind: 'textarea' };

export type EditablePropDefinition = {
  key: EditablePropKey;
  label: string;
  control: PropControl;
};

export const EDITABLE_PROP_DEFS: Record<EditablePropKey, EditablePropDefinition> = {
  strokeColor: { key: 'strokeColor', label: 'Stroke color', control: { kind: 'color' } },
  strokeWidth: {
    key: 'strokeWidth',
    label: 'Stroke width',
    control: { kind: 'range', min: 1, max: 12, step: 1 },
  },
  fillColor: { key: 'fillColor', label: 'Fill color', control: { kind: 'color' } },
  textColor: { key: 'textColor', label: 'Text color', control: { kind: 'color' } },
  fontSize: {
    key: 'fontSize',
    label: 'Font size',
    control: { kind: 'range', min: 8, max: 64, step: 1 },
  },
  text: { key: 'text', label: 'Text', control: { kind: 'textarea' } },
};

const SELECTION_CAPABILITIES: Partial<Record<WhiteboardObjectType, SelectionCapabilities>> = {
  rectangle: rectangleSelectionCapabilities,
  ellipse: ellipseSelectionCapabilities,
  stickyNote: stickyNoteSelectionCapabilities,
  text: textSelectionCapabilities,
  connector: connectorSelectionCapabilities,
  // freehand intentionally omitted (no editable selection props)
};

export function getSelectionCapabilities(objType: WhiteboardObjectType): SelectionCapabilities {
  return SELECTION_CAPABILITIES[objType] ?? { editableProps: [] };
}

export function getEditablePropsForObject(obj: WhiteboardObject): readonly EditablePropKey[] {
  return getSelectionCapabilities(obj.type).editableProps;
}

/**
 * Returns the ordered set of editable props that are common across all objects in selection.
 * Ordering follows EDITABLE_PROP_DEFS key order.
 */
export function getCommonEditableProps(objects: WhiteboardObject[]): readonly EditablePropKey[] {
  if (objects.length === 0) return [];

  const sets = objects.map((o) => new Set(getEditablePropsForObject(o)));
  const common: EditablePropKey[] = [];

  // Intersect in the order of EDITABLE_PROP_DEFS
  for (const key of Object.keys(EDITABLE_PROP_DEFS) as EditablePropKey[]) {
    if (sets.every((s) => s.has(key))) common.push(key);
  }

  return common;
}

export function getSharedPropValue<K extends keyof WhiteboardObject>(
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
