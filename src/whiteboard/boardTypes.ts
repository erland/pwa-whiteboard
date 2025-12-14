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
  /** Hide settings for a tool (panel). UI-only in Step 4. */
  hiddenToolProps?: Partial<Record<ToolId, readonly EditablePropKey[]>>;
  /** Hide settings in selection panel by object type. UI-only in Step 4. */
  hiddenSelectionProps?: Partial<Record<WhiteboardObjectType, readonly EditablePropKey[]>>;
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
      // Keep order aligned with TOOL_REGISTRY to match current toolbar ordering.
      ...TOOL_REGISTRY.filter((t) => t.id !== 'select').map((t) => tool(t.id, t.label, t.icon)),
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
      // Example policy scaffolding (not wired yet in Step 4).
      hiddenToolProps: {
        stickyNote: ['strokeColor', 'textColor'],
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
