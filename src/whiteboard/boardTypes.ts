// src/whiteboard/boardTypes.ts

/**
 * Board types are a configuration layer that controls:
 * - Which tools appear in the toolbox for a board
 * - Which settings are visible (and later: locked) for tool/selection panels
 *
 * Step 2 creates the single source of truth, but does not yet wire any runtime
 * behavior to it. Later steps will progressively delegate UI and state updates
 * to these definitions.
 */

import type { BoardTypeId, WhiteboardObject, WhiteboardObjectType } from '../domain/types';
import type { ToolId } from './tools/registry';
import type { EditablePropKey } from './tools/selection/types';

export type ToolInstanceId = string;

/**
 * A tool instance is what the toolbox renders.
 * Multiple instances can point to the same base tool (e.g. filled vs outline rectangle).
 */
export interface ToolInstanceDefinition {
  /** Unique id within the toolbox, persisted in UI state in later steps. */
  id: ToolInstanceId;

  /** Which underlying tool implementation this instance uses. */
  baseToolId: ToolId;

  /** UI label. */
  label: string;

  /** Optional icon for UI (kept as a simple string, e.g., emoji). */
  icon?: string;

  /** Defaults applied when this tool instance becomes active. */
  defaults?: Partial<WhiteboardObject>;

  /** Optional per-instance hidden tool-setting keys (UI-only). */
  hiddenToolProps?: readonly EditablePropKey[];

  /** Optional per-instance locked tool-setting values (enforced later). */
  lockedToolProps?: Partial<Pick<WhiteboardObject, EditablePropKey>>;
}

/**
 * Board-level policies.
 *
 * NOTE: These are not enforced in Step 2. They are defined now so later steps
 * can wire them in without changing the config shape.
 */
export interface BoardTypePolicy {
  /** Hidden tool-setting keys per base tool id. */
  hiddenToolPropsByTool?: Partial<Record<ToolId, readonly EditablePropKey[]>>;

  /** Locked tool-setting values per base tool id (wins over user edits). */
  lockedToolPropsByTool?: Partial<
    Record<ToolId, Partial<Pick<WhiteboardObject, EditablePropKey>>>
  >;

  /** Hidden selection-setting keys per object type. */
  hiddenSelectionPropsByObjectType?: Partial<
    Record<WhiteboardObjectType, readonly EditablePropKey[]>
  >;

  /** Locked object properties per object type (enforced on create/update later). */
  lockedObjectPropsByObjectType?: Partial<
    Record<WhiteboardObjectType, Partial<Pick<WhiteboardObject, EditablePropKey>>>
  >;
}

export interface BoardTypeDefinition {
  id: BoardTypeId;
  label: string;
  description?: string;

  /** Toolbox entries for this board type, in display order. */
  toolbox: readonly ToolInstanceDefinition[];

  /** Optional policy rules for tool/selection settings. */
  policy?: BoardTypePolicy;
}

function tool(
  baseToolId: ToolId,
  label: string,
  icon?: string,
  extras?: Omit<ToolInstanceDefinition, 'id' | 'baseToolId' | 'label' | 'icon'>
): ToolInstanceDefinition {
  return {
    id: baseToolId,
    baseToolId,
    label,
    icon,
    ...extras,
  };
}

/**
 * Single source of truth for available board types.
 */
export const BOARD_TYPES: Record<BoardTypeId, BoardTypeDefinition> = {
  advanced: {
    id: 'advanced',
    label: 'Advanced',
    description: 'All tools available (matches current behavior).',
    toolbox: [
      tool('freehand', 'Freehand', '✏️'),
      tool('rectangle', 'Rectangle', '▭'),
      tool('roundedRect', 'Rounded rect', '▢'),
      tool('ellipse', 'Ellipse', '⬭'),
      tool('diamond', 'Diamond', '◇'),
      tool('connector', 'Connector', '🔗'),
      tool('text', 'Text', '🔤'),
      tool('stickyNote', 'Sticky note', '🗒'),
      tool('select', 'Select', '🖱'),
    ],
  },

  freehand: {
    id: 'freehand',
    label: 'Freehand',
    description: 'Only freehand drawing + selection.',
    toolbox: [tool('freehand', 'Freehand', '✏️'), tool('select', 'Select', '🖱')],
  },

  brainstorming: {
    id: 'brainstorming',
    label: 'Brainstorming',
    description: 'Simplified tools for ideation (sticky notes + selection).',
    toolbox: [
      tool('stickyNote', 'Sticky note', '🗒'),
      tool('freehand', 'Freehand', '✏️'),
      tool('select', 'Select', '🖱'),
    ],
    policy: {
      // Example: hide some sticky note style controls to keep the UI simple.
      // (Enforcement will come in later steps.)
      hiddenToolPropsByTool: {
        stickyNote: ['strokeColor', 'textColor'],
      },
      hiddenSelectionPropsByObjectType: {
        stickyNote: ['strokeColor', 'textColor'],
      },
    },
  },
} as const;

export const BOARD_TYPE_IDS = Object.keys(BOARD_TYPES) as BoardTypeId[];

/**
 * Get the board type definition for a given id.
 * Falls back to 'advanced' for any unexpected value.
 */
export function getBoardType(id: BoardTypeId | string | undefined | null): BoardTypeDefinition {
  if (!id) return BOARD_TYPES.advanced;
  const candidate = (BOARD_TYPES as Record<string, BoardTypeDefinition>)[id];
  return candidate ?? BOARD_TYPES.advanced;
}

/**
 * Convenience: ensures a board type's toolbox always includes selection.
 * Helpful as a guardrail in tests and future runtime wiring.
 */
export function boardTypeHasSelection(def: BoardTypeDefinition): boolean {
  return def.toolbox.some((t) => t.baseToolId === 'select');
}
