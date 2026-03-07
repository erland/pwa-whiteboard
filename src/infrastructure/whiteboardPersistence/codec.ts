import type { WhiteboardId, WhiteboardState } from '../../domain/types';
import { createEmptyWhiteboardState } from '../../domain/whiteboardState';
import { asMeta } from './migration';
import {
  FREEHAND_POINTS_SCALE,
  PERSIST_SCHEMA_VERSION,
  type PersistedBoardStateV2,
} from './types';

export function packPoints(points: Array<{ x: number; y: number }>): string {
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

export function unpackPoints(
  packed: string,
  scale = FREEHAND_POINTS_SCALE,
): Array<{ x: number; y: number }> {
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

export function packObjectsForStorage(objects: any[]): any[] {
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

export function unpackObjectsFromStorage(objects: any[]): any[] {
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

export function snapshotToPersistedV2(
  id: WhiteboardId,
  state: WhiteboardState,
): PersistedBoardStateV2 {
  const meta = asMeta(id, state.meta);
  return {
    schemaVersion: PERSIST_SCHEMA_VERSION,
    meta,
    objects: packObjectsForStorage(state.objects as any[]),
    selectedObjectIds: Array.isArray(state.selectedObjectIds) ? state.selectedObjectIds : [],
    viewport: state.viewport,
  };
}

export function persistedV2ToState(
  id: WhiteboardId,
  parsed: PersistedBoardStateV2,
): WhiteboardState {
  const meta = asMeta(id, parsed.meta);
  const base = createEmptyWhiteboardState(meta);
  return {
    ...base,
    objects: unpackObjectsFromStorage(Array.isArray(parsed.objects) ? parsed.objects : []),
    selectedObjectIds: Array.isArray(parsed.selectedObjectIds) ? parsed.selectedObjectIds : [],
    viewport: parsed.viewport ?? base.viewport,
  };
}

export function isPersistedV2(v: any): v is PersistedBoardStateV2 {
  return !!v && typeof v === 'object' && v.schemaVersion === PERSIST_SCHEMA_VERSION && 'meta' in v && 'objects' in v;
}
