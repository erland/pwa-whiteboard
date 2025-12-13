// src/whiteboard/tools/registry.ts

/**
 * Central registry of tools & object types.
 *
 * Phase 1–3 of the refactor:
 * - Phase 1: introduce a single source of truth WITHOUT changing behavior.
 * - Phase 2: derive tool/object unions from this registry to reduce touch points.
 * - Phase 3: tool selector UI can render from this metadata.
 *
 * IMPORTANT: Core drawing/geometry/interactions are not wired to this registry yet.
 * Later phases will progressively delegate to it.
 */

/**
 * Tool IDs that can be active in the editor.
 * - Includes non-object tools like `select`.
 */
export const TOOL_IDS = [
  'select',
  'freehand',
  'rectangle',
  'ellipse',
  'text',
  'stickyNote',
  'connector',
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

/**
 * Object types that can exist on the canvas.
 * - Excludes non-object tools like `select`.
 */
export const OBJECT_TYPES = [
  'freehand',
  'rectangle',
  'ellipse',
  'text',
  'stickyNote',
  'connector',
] as const;

export type ObjectType = (typeof OBJECT_TYPES)[number];

export type ToolKind = 'select' | 'draw';

/**
 * Minimal metadata about a tool.
 *
 * Kept intentionally small early on; richer per-tool interfaces (draw/geometry/
 * interactions/panels) will come in later phases.
 */
export interface ToolRegistryEntry {
  id: ToolId;
  kind: ToolKind;

  /** Label for UI (e.g., toolbar). */
  label: string;

  /** Optional icon for UI (kept as a simple string, e.g., emoji). */
  icon?: string;

  /**
   * If the tool creates an object on the board, this is the object type.
   * `select` has no objectType.
   */
  objectType?: ObjectType;
}

/**
 * Ordered list of tools.
 *
 * NOTE: In Phase 3 we align the order with the existing toolbar layout to avoid
 * any behavior/UI changes from the refactor.
 */
export const TOOL_REGISTRY: readonly ToolRegistryEntry[] = [
  { id: 'freehand', kind: 'draw', label: 'Freehand', icon: '✏️', objectType: 'freehand' },
  { id: 'rectangle', kind: 'draw', label: 'Rectangle', icon: '▭', objectType: 'rectangle' },
  { id: 'ellipse', kind: 'draw', label: 'Ellipse', icon: '⬭', objectType: 'ellipse' },
  { id: 'connector', kind: 'draw', label: 'Connector', icon: '🔗', objectType: 'connector' },
  { id: 'text', kind: 'draw', label: 'Text', icon: '🔤', objectType: 'text' },
  { id: 'stickyNote', kind: 'draw', label: 'Sticky note', icon: '🗒', objectType: 'stickyNote' },
  { id: 'select', kind: 'select', label: 'Select', icon: '🖱' },
] as const;

export function isToolId(value: string): value is ToolId {
  return (TOOL_IDS as readonly string[]).includes(value);
}

export function isObjectType(value: string): value is ObjectType {
  return (OBJECT_TYPES as readonly string[]).includes(value);
}

export function getToolEntry(id: ToolId): ToolRegistryEntry {
  const entry = TOOL_REGISTRY.find((t) => t.id === id);
  if (!entry) throw new Error(`Unknown tool id: ${id}`);
  return entry;
}
