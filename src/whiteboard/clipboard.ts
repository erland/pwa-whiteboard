// src/whiteboard/clipboard.ts

import type {
  ObjectId,
  WhiteboardClipboardV1,
  WhiteboardObject,
  WhiteboardId,
  Viewport,
  ClipboardBounds,
  Point,
} from '../domain/types';

import { canvasToWorld, getBoundingBox } from './geometry';

export type CanvasSize = {
  width: number;
  height: number;
};

export type CreateClipboardArgs = {
  boardId: WhiteboardId;
  objects: WhiteboardObject[];
  selectedIds: ObjectId[];
  /** ISO timestamp, defaults to new Date().toISOString() */
  nowIso?: string;
};

export type PasteClipboardArgs = {
  clipboard: WhiteboardClipboardV1;
  targetBoardId: WhiteboardId;
  viewport: Viewport;

  /**
   * Canvas size in pixels. Required for cross-board centering.
   * (For same-board paste it is ignored.)
   */
  canvasSize?: CanvasSize;

  /** Existing object ids in the target board (to avoid collisions). */
  existingIds: Iterable<ObjectId>;

  /** Canvas pixel offset for same-board paste. Defaults to 20px. */
  offsetCanvasPx?: number;
  /** Optional ID generator, used for deterministic tests. */
  generateObjectId?: () => ObjectId;
};

export type PasteClipboardResult = {
  objects: WhiteboardObject[];
  selectedIds: ObjectId[];
  nextClipboard: WhiteboardClipboardV1;
};

function deepClone<T>(value: T): T {
  // WhiteboardObject only contains JSON-safe values (plain objects + arrays),
  // so JSON cloning is sufficient and keeps this file dependency-free.
  return JSON.parse(JSON.stringify(value)) as T;
}

function unionBounds(bounds: Array<ClipboardBounds | null>): ClipboardBounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const b of bounds) {
    if (!b) continue;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

function fallbackBoundsFromObjects(objects: WhiteboardObject[]): ClipboardBounds {
  // Conservative fallback: use x/y and any known points/x2/y2.
  // This is mostly a safety net; the main path uses getBoundingBox().
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const take = (p: Point) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  };

  for (const o of objects) {
    take({ x: o.x, y: o.y });
    if (typeof o.x2 === 'number' && typeof o.y2 === 'number') take({ x: o.x2, y: o.y2 });
    if (Array.isArray(o.points)) for (const p of o.points) take(p);
    if (Array.isArray(o.waypoints)) for (const p of o.waypoints) take(p);
    if (typeof o.width === 'number' && typeof o.height === 'number') {
      take({ x: o.x + o.width, y: o.y + o.height });
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

function defaultGenerateObjectId(): ObjectId {
  return (
    'o_' +
    Math.random().toString(16).slice(2) +
    '_' +
    Date.now().toString(16)
  ) as ObjectId;
}

function generateUniqueId(used: Set<ObjectId>, generate: () => ObjectId): ObjectId {
  // Extremely low collision risk, but still safe.
  // This loop is deterministic in tests with a deterministic generator.
  for (let i = 0; i < 10000; i++) {
    const id = generate();
    if (!used.has(id)) {
      used.add(id);
      return id;
    }
  }
  // If something is deeply wrong with the generator, fail loudly.
  throw new Error('Failed to generate a unique ObjectId for paste operation.');
}

function translateObject(obj: WhiteboardObject, dx: number, dy: number): WhiteboardObject {
  // Connectors are attachment-based; their x/y is structurally present but not used
  // to resolve endpoints. We still translate waypoints if they exist.
  if (obj.type === 'connector') {
    const next: WhiteboardObject = { ...obj };
    if (Array.isArray(obj.waypoints)) next.waypoints = obj.waypoints.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    return next;
  }

  const next: WhiteboardObject = { ...obj, x: obj.x + dx, y: obj.y + dy };
  if (typeof obj.x2 === 'number') next.x2 = obj.x2 + dx;
  if (typeof obj.y2 === 'number') next.y2 = obj.y2 + dy;
  if (Array.isArray(obj.points)) next.points = obj.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  if (Array.isArray(obj.waypoints)) next.waypoints = obj.waypoints.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  return next;
}

function boundsCenter(b: ClipboardBounds): Point {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

function computeCrossBoardTranslation(args: {
  clipboardBounds: ClipboardBounds;
  viewport: Viewport;
  canvasSize?: CanvasSize;
}): { dx: number; dy: number } {
  const { clipboardBounds, viewport, canvasSize } = args;
  if (!canvasSize) {
    // Keep behavior deterministic even if the caller forgot to pass canvas size.
    // (Cross-board centering requires canvas size.)
    return { dx: 0, dy: 0 };
  }

  const targetCenterWorld = canvasToWorld(canvasSize.width / 2, canvasSize.height / 2, viewport);
  const srcCenterWorld = boundsCenter(clipboardBounds);
  return {
    dx: targetCenterWorld.x - srcCenterWorld.x,
    dy: targetCenterWorld.y - srcCenterWorld.y,
  };
}

function remapConnectorReferences(args: {
  obj: WhiteboardObject;
  idMap: Map<ObjectId, ObjectId>;
  sameBoard: boolean;
}): WhiteboardObject | null {
  const { obj, idMap, sameBoard } = args;
  if (obj.type !== 'connector') return obj;
  if (!obj.from || !obj.to) return obj;

  const fromNew = idMap.get(obj.from.objectId);
  const toNew = idMap.get(obj.to.objectId);

  // Same-board paste can keep references to existing objects that were not copied.
  if (sameBoard) {
    return {
      ...obj,
      from: { ...obj.from, objectId: fromNew ?? obj.from.objectId },
      to: { ...obj.to, objectId: toNew ?? obj.to.objectId },
    };
  }

  // Cross-board paste: we can only keep connectors if BOTH endpoints are part of the pasted set.
  if (!fromNew || !toNew) return null;

  return {
    ...obj,
    from: { ...obj.from, objectId: fromNew },
    to: { ...obj.to, objectId: toNew },
  };
}

/**
 * Create a clipboard payload from the current selection.
 * Returns null if there is no selection.
 */
export function createClipboardFromSelection({
  boardId,
  objects,
  selectedIds,
  nowIso,
}: CreateClipboardArgs): WhiteboardClipboardV1 | null {
  const selectedSet = new Set(selectedIds);
  const selectedObjects = objects.filter((o) => selectedSet.has(o.id));
  if (selectedObjects.length === 0) return null;

  const boundsCandidates = selectedObjects.map((o) => {
    const b = getBoundingBox(o, objects);
    return b ? ({ x: b.x, y: b.y, width: b.width, height: b.height } satisfies ClipboardBounds) : null;
  });
  const bounds = unionBounds(boundsCandidates) ?? fallbackBoundsFromObjects(selectedObjects);

  return {
    version: 1,
    sourceBoardId: boardId,
    copiedAt: nowIso ?? new Date().toISOString(),
    objects: deepClone(selectedObjects),
    bounds,
    pasteCount: 0,
  };
}

/**
 * Paste the clipboard into the target board.
 *
 * Step 2 behavior:
 * - Always remap ids for pasted objects.
 * - If pasting into the *same* board as copied from, apply a small offset.
 * - If pasting into a *different* board, translate the pasted selection so its bounds
 *   end up centered in the canvas.
 * - Connector endpoint references are remapped if the referenced objects are included
 *   in the clipboard; otherwise:
 *   - same-board paste keeps references to existing objects
 *   - cross-board paste skips connectors that reference outside the clipboard
 */
export function pasteClipboard({
  clipboard,
  targetBoardId,
  viewport,
  canvasSize,
  existingIds,
  offsetCanvasPx = 20,
  generateObjectId = defaultGenerateObjectId,
}: PasteClipboardArgs): PasteClipboardResult {
  const used = new Set<ObjectId>(Array.from(existingIds));

  const idMap = new Map<ObjectId, ObjectId>();
  for (const obj of clipboard.objects) {
    const nextId = generateUniqueId(used, generateObjectId);
    idMap.set(obj.id, nextId);
  }

  // Same-board progressive offset.
  const sameBoard = targetBoardId === clipboard.sourceBoardId;
  const zoom = viewport.zoom ?? 1;
  const step = sameBoard ? ((clipboard.pasteCount ?? 0) + 1) : 0;

  const sameBoardDx = (offsetCanvasPx / zoom) * step;
  const sameBoardDy = (offsetCanvasPx / zoom) * step;

  const cross = computeCrossBoardTranslation({
    clipboardBounds: clipboard.bounds,
    viewport,
    canvasSize,
  });

  const dx = sameBoard ? sameBoardDx : cross.dx;
  const dy = sameBoard ? sameBoardDy : cross.dy;

  const pastedObjects: WhiteboardObject[] = [];
  for (const obj of clipboard.objects) {
    const newId = idMap.get(obj.id)!;
    const cloned = deepClone(obj);
    cloned.id = newId;

    const remappedOrNull = remapConnectorReferences({
      obj: cloned,
      idMap,
      sameBoard,
    });
    if (!remappedOrNull) {
      // Cross-board: connector references outside the clipboard cannot be resolved.
      continue;
    }

    pastedObjects.push(translateObject(remappedOrNull, dx, dy));
  }

  const pastedIdSet = new Set(pastedObjects.map((o) => o.id));
  const selectedIds = clipboard.objects
    .map((o) => idMap.get(o.id)!)
    .filter((id) => pastedIdSet.has(id));

  const nextClipboard: WhiteboardClipboardV1 = {
    ...clipboard,
    // Keep original copiedAt/sourceBoardId/objects/bounds.
    // Increment pasteCount only for same-board pastes.
    pasteCount: sameBoard ? (clipboard.pasteCount ?? 0) + 1 : clipboard.pasteCount ?? 0,
  };

  return {
    objects: pastedObjects,
    selectedIds,
    nextClipboard,
  };
}
