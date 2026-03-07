import type { WhiteboardId, WhiteboardMeta, WhiteboardState } from './types';
import { DEFAULT_BOARD_TYPE, isBoardType } from './boardType';
import { createEmptyWhiteboardState } from './whiteboardState';
const PERSIST_SCHEMA_VERSION = 2 as const;
const FREEHAND_POINTS_SCALE = 10;

type PersistedBoardStateV2 = {
  schemaVersion: typeof PERSIST_SCHEMA_VERSION;
  meta: WhiteboardMeta;
  objects: any[];
  selectedObjectIds: string[];
  viewport: any;
};

function packPoints(points: Array<{ x: number; y: number }>): string {
  const scale = FREEHAND_POINTS_SCALE;
  let out = '';
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const x = Math.round(p.x * scale);
    const y = Math.round(p.y * scale);
    out += `${x},${y}`;
    if (i !== points.length - 1) out += ';';
  }
  return out;
}

function unpackPoints(packed: string, scale = FREEHAND_POINTS_SCALE): Array<{ x: number; y: number }> {
  if (!packed) return [];
  const parts = packed.split(';');
  const pts: Array<{ x: number; y: number }> = [];
  for (const part of parts) {
    const [xs, ys] = part.split(',');
    const xi = Number(xs);
    const yi = Number(ys);
    if (!Number.isFinite(xi) || !Number.isFinite(yi)) continue;
    pts.push({ x: xi / scale, y: yi / scale });
  }
  return pts;
}

function packObjectsForStorage(objects: any[]): any[] {
  return objects.map((o) => {
    if (o && o.type === 'freehand' && Array.isArray(o.points)) {
      const { points, ...rest } = o;
      return {
        ...rest,
        pointsPacked: packPoints(points),
        pointsScale: FREEHAND_POINTS_SCALE,
      };
    }
    return o;
  });
}

function unpackObjectsFromStorage(objects: any[]): any[] {
  return objects.map((o) => {
    if (o && o.type === 'freehand' && !Array.isArray(o.points) && typeof o.pointsPacked === 'string') {
      const scale = typeof o.pointsScale === 'number' ? o.pointsScale : FREEHAND_POINTS_SCALE;
      const { pointsPacked, pointsScale, ...rest } = o;
      return {
        ...rest,
        points: unpackPoints(pointsPacked, scale),
      };
    }
    return o;
  });
}


function migrateLoadedState(state: WhiteboardState): WhiteboardState {
  const metaAny = (state as any).meta ?? {};
  const boardType = isBoardType(metaAny.boardType) ? metaAny.boardType : DEFAULT_BOARD_TYPE;
  if (metaAny.boardType === boardType) return state;
  return { ...state, meta: { ...state.meta, boardType } };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function asMeta(id: WhiteboardId, rawMeta: unknown): WhiteboardMeta {
  const now = new Date().toISOString();
  const m = isRecord(rawMeta) ? (rawMeta as Record<string, unknown>) : {};
  const name = typeof m.name === 'string' ? m.name : 'Untitled board';
  const createdAt = typeof m.createdAt === 'string' ? m.createdAt : now;
  const updatedAt = typeof m.updatedAt === 'string' ? m.updatedAt : createdAt;
  const boardType = isBoardType(m.boardType) ? m.boardType : DEFAULT_BOARD_TYPE;
  return { id, name, boardType, createdAt, updatedAt };
}

function snapshotToPersistedV2(id: WhiteboardId, state: WhiteboardState): PersistedBoardStateV2 {
  const meta = asMeta(id, state.meta);
  return {
    schemaVersion: PERSIST_SCHEMA_VERSION,
    meta,
    objects: packObjectsForStorage(state.objects as any[]),
    selectedObjectIds: Array.isArray(state.selectedObjectIds) ? state.selectedObjectIds : [],
    viewport: state.viewport,
  };
}

function persistedV2ToState(id: WhiteboardId, parsed: PersistedBoardStateV2): WhiteboardState {
  const meta = asMeta(id, parsed.meta);
  const base = createEmptyWhiteboardState(meta);
  return {
    ...base,
    objects: unpackObjectsFromStorage(Array.isArray(parsed.objects) ? parsed.objects : []),
    selectedObjectIds: Array.isArray(parsed.selectedObjectIds) ? parsed.selectedObjectIds : [],
    viewport: (parsed as any).viewport ?? base.viewport,
  };
}

function isPersistedV2(v: any): v is PersistedBoardStateV2 {
  return !!v && typeof v === 'object' && v.schemaVersion === PERSIST_SCHEMA_VERSION && 'meta' in v && 'objects' in v;
}

/** Encode a compact snapshot suitable for persistence/transmission (no history). */
export function encodeSnapshotJson(boardId: WhiteboardId, state: WhiteboardState): string {
  const payload = snapshotToPersistedV2(boardId, state);
  return JSON.stringify(payload);
}

/** Decode snapshotJson from server/localStorage into a usable WhiteboardState. */
export function decodeSnapshotJson(boardId: WhiteboardId, snapshotJson: string): WhiteboardState | null {
  if (!snapshotJson) return null;
  try {
    const parsed = JSON.parse(snapshotJson);

    if (isPersistedV2(parsed)) {
      return migrateLoadedState(persistedV2ToState(boardId, parsed));
    }

    // Allow "raw WhiteboardState" snapshots for forward/back compat
    if (parsed && typeof parsed === 'object' && 'meta' in parsed && 'objects' in parsed) {
      const raw = parsed as WhiteboardState;
      const loaded = migrateLoadedState(raw);
      const objs = Array.isArray((loaded as any).objects)
        ? unpackObjectsFromStorage((loaded as any).objects)
        : loaded.objects;
      return { ...loaded, objects: objs as any };
    }
  } catch {
    // ignore
  }
  return null;
}
