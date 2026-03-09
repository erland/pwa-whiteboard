import type { BoardRole } from '../types';

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function isString(v: unknown): v is string {
  return typeof v === 'string';
}

export function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function isInt(v: unknown): v is number {
  return isNumber(v) && Number.isInteger(v);
}

export function withinChars(s: string, max: number): boolean {
  return s.length > 0 && s.length <= max;
}

export function optionalWithinChars(s: unknown, max: number): boolean {
  return s === undefined || (isString(s) && s.length <= max);
}

export function normalizeBoardRole(v: unknown): BoardRole | null {
  if (v === 'OWNER') return 'owner';
  if (v === 'EDITOR') return 'editor';
  if (v === 'VIEWER') return 'viewer';
  if (v === 'owner' || v === 'editor' || v === 'viewer') return v;
  return null;
}
