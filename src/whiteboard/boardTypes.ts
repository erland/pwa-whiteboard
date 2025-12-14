// src/whiteboard/boardTypes.ts

/**
 * Board types are a configuration layer that controls:
 * - Which tools appear in the toolbox for a board
 * - Which settings are visible (and later: locked) for tool/selection panels
 *
 * Step 2 introduced this module as a single source of truth.
 * Step 4 wires toolbox rendering + active tool instance selection to these definitions.
 */

import type { BoardTypeId, WhiteboardObject, WhiteboardObjectType } from '../domain/types';
import { TOOL_REGISTRY, type ToolId } from './tools/registry';
import type { EditablePropKey } from './tools/selection/types';

export type ToolInstanceId = string;

export type ToolInstanceDefinition = {
  /** Unique id for this entry in the toolbox (enables presets, duplicates, etc.). */
  id: ToolInstanceId;
  /** The underlying tool implementation used by canvas interactions. */
  baseToolId: ToolId;
  /** Label shown in the tool selector UI. */
  label: string;
  /** Optional icon/emoji. */
  icon?: string;
  /** Optional defaults for this tool instance (used in later steps). */
  defaults?: Partial<WhiteboardObject>;
};

export type BoardTypePolicy = {
  /**
   * Hide settings for a tool (panel).
   * If a property is hidden, the control will not be shown.
   */
  hiddenToolProps?: Partial<Record<ToolId, readonly EditablePropKey[]>>;

  /**
   * Lock settings for a tool (panel).
   * Locked properties are forced to the provided value and cannot be edited.
   */
  lockedToolProps?: Partial<Record<ToolId, Partial<WhiteboardObject>>>;

  /**
   * Hide settings in selection panel by object type.
   * If multiple object types are selected, any hidden key for any selected type will be hidden.
   */
  hiddenSelectionProps?: Partial<Record<WhiteboardObjectType, readonly EditablePropKey[]>>;

  /**
   * Lock object properties by object type.
   * Enforced in the reducer (objectCreated/objectUpdated).
   */
  lockedObjectProps?: Partial<Record<WhiteboardObjectType, Partial<WhiteboardObject>>>;
};

export type BoardTypeDefinition = {
  id: BoardTypeId;
  label: string;
  description: string;
  toolbox: readonly ToolInstanceDefinition[];
  policy?: BoardTypePolicy;
};

function tool(baseToolId: ToolId, label: string, icon?: string, instanceId?: string): ToolInstanceDefinition {
  return { id: instanceId ?? baseToolId, baseToolId, label, icon };
}

function preset(
  instanceId: ToolInstanceId,
  baseToolId: ToolId,
  label: string,
  icon: string | undefined,
  defaults: Partial<WhiteboardObject>
): ToolInstanceDefinition {
  return { id: instanceId, baseToolId, label, icon, defaults };
}

/**
 * Single source of truth for board types.
 *
 * NOTE: For now, each toolbox entry maps 1:1 to the underlying tool id.
 * Later we will add duplicates/presets (e.g. rect-filled vs rect-outline).
 */
export const BOARD_TYPES: Record<BoardTypeId, BoardTypeDefinition> = {
  advanced: {
    id: 'advanced',
    label: 'Advanced',
    description: 'All tools available.',
    toolbox: [
      // Keep order aligned with TOOL_REGISTRY to match current toolbar ordering,
      // but replace the single "Rectangle" tool with two presets.
      tool('freehand', 'Freehand', '✏️'),

      // Presets
      preset('rect-outline', 'rectangle', 'Rectangle (outline)', '▭', {
        // No fill by default (outline-only)
        fillColor: undefined,
      }),
      preset('rect-filled', 'rectangle', 'Rectangle (filled)', '▮', {
        // Default fill color; user can change it per preset via tool settings.
        fillColor: '#ffffff',
      }),

      // Remaining tools
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
    description: 'Simplified tools for ideation (sticky notes + freehand + selection).',
    toolbox: [tool('stickyNote', 'Sticky note', '🗒'), tool('freehand', 'Freehand', '✏️'), tool('select', 'Select', '🖱')],
    policy: {
      // Example policy: simplify sticky notes by hiding and locking some style controls.
      hiddenToolProps: {
        stickyNote: ['strokeColor', 'textColor', 'fillColor'],
      },
      hiddenSelectionProps: {
        stickyNote: ['strokeColor', 'textColor', 'fillColor'],
      },
      lockedObjectProps: {
        stickyNote: {
          // Fixed "brainstorm" style: bright note + dark text/border.
          fillColor: '#fef08a', // soft yellow
          strokeColor: '#0f172a',
          textColor: '#0f172a',
        },
      },
    },
  },
} as const;

export const BOARD_TYPE_IDS = Object.keys(BOARD_TYPES) as BoardTypeId[];

/** Safe getter with fallback to 'advanced'. */
export function getBoardType(id: BoardTypeId | string | undefined | null): BoardTypeDefinition {
  if (!id) return BOARD_TYPES.advanced;
  const candidate = (BOARD_TYPES as Record<string, BoardTypeDefinition>)[id];
  return candidate ?? BOARD_TYPES.advanced;
}

/** Ensures a board type's toolbox always includes selection. */
export function boardTypeHasSelection(def: BoardTypeDefinition): boolean {
  return def.toolbox.some((t) => t.baseToolId === 'select');
}

function toSet(keys: readonly EditablePropKey[] | undefined): Set<EditablePropKey> {
  return new Set((keys ?? []) as EditablePropKey[]);
}

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/** Hidden tool prop keys for this board type + tool id. */
export function getHiddenToolPropKeys(def: BoardTypeDefinition, toolId: ToolId): Set<EditablePropKey> {
  return toSet(def.policy?.hiddenToolProps?.[toolId]);
}

/** Locked tool props for this board type + tool id. */
export function getLockedToolProps(def: BoardTypeDefinition, toolId: ToolId): Partial<WhiteboardObject> {
  const fromTool = def.policy?.lockedToolProps?.[toolId] ?? {};
  // For creation tools, tool id === object type; allow reuse of lockedObjectProps.
  const fromObj = (def.policy?.lockedObjectProps as any)?.[toolId] ?? {};
  return { ...(fromTool as any), ...(fromObj as any) } as Partial<WhiteboardObject>;
}

/** Hidden selection prop keys for this board type + object type. */
export function getHiddenSelectionPropKeys(def: BoardTypeDefinition, objectType: WhiteboardObjectType): Set<EditablePropKey> {
  return toSet(def.policy?.hiddenSelectionProps?.[objectType]);
}

/** Locked object props for this board type + object type (enforced in reducer). */
export function getLockedObjectProps(def: BoardTypeDefinition, objectType: WhiteboardObjectType): Partial<WhiteboardObject> {
  return (def.policy?.lockedObjectProps?.[objectType] ?? {}) as Partial<WhiteboardObject>;
}

/** Extracts which editable keys are locked by a locked-props object. */
export function getLockedEditableKeys(locked: Partial<WhiteboardObject>): Set<EditablePropKey> {
  const keys: EditablePropKey[] = [];
  (['strokeColor', 'strokeWidth', 'fillColor', 'textColor', 'fontSize', 'cornerRadius', 'text'] as const).forEach((k) => {
    if (hasOwn(locked, k)) keys.push(k);
  });
  return new Set(keys);
}

/** True if a given editable prop is locked (even if the locked value is undefined). */
export function isEditablePropLocked(locked: Partial<WhiteboardObject>, key: EditablePropKey): boolean {
  return hasOwn(locked, key);
}
