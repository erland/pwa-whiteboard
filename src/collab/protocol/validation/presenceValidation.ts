import {
  MAX_BOARD_ID_CHARS,
  MAX_COLOR_CHARS,
  MAX_DISPLAY_NAME_CHARS,
  MAX_SELECTION_IDS,
  MAX_USER_ID_CHARS,
} from '../limits';
import type { PresencePayload, PresenceUser } from '../types';
import { isNumber, isRecord, isString, normalizeBoardRole, withinChars } from './helpers';
import type { ValidationResult } from './types';

export function validatePresencePayload(v: unknown): ValidationResult<PresencePayload> {
  if (!isRecord(v)) return { ok: false, error: 'presence must be an object' };

  const out: PresencePayload = {};

  if (v.cursor !== undefined) {
    if (!isRecord(v.cursor) || !isNumber(v.cursor.x) || !isNumber(v.cursor.y)) {
      return { ok: false, error: 'presence.cursor must be {x:number,y:number}' };
    }
    out.cursor = { x: v.cursor.x, y: v.cursor.y };
  }

  if (v.viewport !== undefined) {
    if (!isRecord(v.viewport) || !isNumber(v.viewport.panX) || !isNumber(v.viewport.panY) || !isNumber(v.viewport.zoom)) {
      return { ok: false, error: 'presence.viewport must be {panX:number,panY:number,zoom:number}' };
    }
    out.viewport = { panX: v.viewport.panX, panY: v.viewport.panY, zoom: v.viewport.zoom };
  }

  if (v.isTyping !== undefined) {
    if (typeof v.isTyping !== 'boolean') {
      return { ok: false, error: 'presence.isTyping must be boolean' };
    }
    out.isTyping = v.isTyping;
  }

  if (v.selectionIds !== undefined) {
    if (!Array.isArray(v.selectionIds)) {
      return { ok: false, error: 'presence.selectionIds must be string[]' };
    }
    if (v.selectionIds.length > MAX_SELECTION_IDS) {
      return { ok: false, error: `presence.selectionIds max length ${MAX_SELECTION_IDS}` };
    }
    for (const id of v.selectionIds) {
      if (!isString(id) || id.length === 0 || id.length > MAX_BOARD_ID_CHARS) {
        return { ok: false, error: 'presence.selectionIds must contain short non-empty strings' };
      }
    }
    out.selectionIds = v.selectionIds as string[];
  }

  return { ok: true, value: out };
}

export function validatePresenceUser(v: unknown): ValidationResult<PresenceUser> {
  if (!isRecord(v)) return { ok: false, error: 'user must be an object' };
  if (!isString(v.userId) || !withinChars(v.userId, MAX_USER_ID_CHARS)) {
    return { ok: false, error: `user.userId must be a non-empty string (<=${MAX_USER_ID_CHARS})` };
  }
  if (!isString(v.displayName) || v.displayName.length === 0 || v.displayName.length > MAX_DISPLAY_NAME_CHARS) {
    return { ok: false, error: `user.displayName must be 1..${MAX_DISPLAY_NAME_CHARS} chars` };
  }
  if (v.color !== undefined && (!isString(v.color) || v.color.length > MAX_COLOR_CHARS)) {
    return { ok: false, error: `user.color must be <=${MAX_COLOR_CHARS}` };
  }
  const role = normalizeBoardRole(v.role);
  if (!role) return { ok: false, error: 'user.role must be owner|editor|viewer' };
  return {
    ok: true,
    value: {
      userId: v.userId,
      displayName: v.displayName,
      color: v.color as string | undefined,
      role,
    },
  };
}
