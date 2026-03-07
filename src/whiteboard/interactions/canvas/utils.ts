import type { Viewport, WhiteboardObject } from '../../../domain/types';
import { canvasToWorld, resolveConnectorEndpoints, worldToCanvas } from '../../geometry';

export function cloneObj<T>(obj: T): T {
  try {
    // @ts-ignore
    if (typeof structuredClone === 'function') return structuredClone(obj);
  } catch {
    // ignore
  }
  return JSON.parse(JSON.stringify(obj)) as T;
}

function isDeepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  const ta = typeof a;
  const tb = typeof b;
  if (ta !== tb) return false;
  if (a && b && ta === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

export function minimizePatch(original: any, patch: Record<string, any>): Record<string, any> | null {
  const out: any = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!isDeepEqual(original?.[k], v)) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

export function createCanvasPointerHelpers(
  viewport: Viewport,
  canvasWidth: number,
  canvasHeight: number
) {
  const getCanvasPos = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = evt.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width || 1;
    const scaleY = canvasHeight / rect.height || 1;
    const canvasX = (evt.clientX - rect.left) * scaleX;
    const canvasY = (evt.clientY - rect.top) * scaleY;
    return canvasToWorld(canvasX, canvasY, viewport);
  };

  const getCanvasXY = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = evt.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width || 1;
    const scaleY = canvasHeight / rect.height || 1;
    const canvasX = (evt.clientX - rect.left) * scaleX;
    const canvasY = (evt.clientY - rect.top) * scaleY;
    return { canvasX, canvasY };
  };

  const setPointerCaptureSafe = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const el = evt.target as HTMLCanvasElement;
    try {
      (el as any).setPointerCapture?.(evt.pointerId);
    } catch {
      // ignore
    }
  };

  const releasePointerCaptureSafe = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const el = evt.target as HTMLCanvasElement;
    try {
      (el as any).releasePointerCapture?.(evt.pointerId);
    } catch {
      // ignore
    }
  };

  return {
    getCanvasPos,
    getCanvasXY,
    setPointerCaptureSafe,
    releasePointerCaptureSafe,
  };
}

export function getConnectorEndpointHit(
  connector: WhiteboardObject,
  objects: WhiteboardObject[],
  viewport: Viewport,
  pointerCanvasX: number,
  pointerCanvasY: number
): 'from' | 'to' | null {
  const endpoints = resolveConnectorEndpoints(objects, connector);
  if (!endpoints) return null;

  const a = worldToCanvas(endpoints.p1.x, endpoints.p1.y, viewport);
  const b = worldToCanvas(endpoints.p2.x, endpoints.p2.y, viewport);

  const dxA = pointerCanvasX - a.x;
  const dyA = pointerCanvasY - a.y;
  const dxB = pointerCanvasX - b.x;
  const dyB = pointerCanvasY - b.y;

  const dA2 = dxA * dxA + dyA * dyA;
  const dB2 = dxB * dxB + dyB * dyB;

  const HIT_R = 10;
  const hit2 = HIT_R * HIT_R;

  const hitA = dA2 <= hit2;
  const hitB = dB2 <= hit2;
  if (!hitA && !hitB) return null;
  if (hitA && !hitB) return 'from';
  if (!hitA && hitB) return 'to';
  return dA2 <= dB2 ? 'from' : 'to';
}

export function getLineEndpointHit(
  line: WhiteboardObject,
  viewport: Viewport,
  pointerCanvasX: number,
  pointerCanvasY: number
): 'start' | 'end' | null {
  if (line.type !== 'line') return null;

  const a = worldToCanvas(line.x, line.y, viewport);
  const b = worldToCanvas(line.x2 ?? line.x, line.y2 ?? line.y, viewport);

  const dxA = pointerCanvasX - a.x;
  const dyA = pointerCanvasY - a.y;
  const dxB = pointerCanvasX - b.x;
  const dyB = pointerCanvasY - b.y;

  const dA2 = dxA * dxA + dyA * dyA;
  const dB2 = dxB * dxB + dyB * dyB;

  const HIT_R = 10;
  const hit2 = HIT_R * HIT_R;

  const hitA = dA2 <= hit2;
  const hitB = dB2 <= hit2;
  if (!hitA && !hitB) return null;
  if (hitA && !hitB) return 'start';
  if (!hitA && hitB) return 'end';
  return dA2 <= dB2 ? 'start' : 'end';
}
