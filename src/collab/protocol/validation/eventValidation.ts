import type { BoardEvent } from '../../../domain';
import {
  MAX_BOARD_ID_CHARS,
  MAX_CLIENT_OP_ID_CHARS,
  MAX_COLOR_CHARS,
  MAX_OBJECT_ID_CHARS,
  MAX_SELECTION_IDS,
  MAX_TEXT_CHARS,
} from '../limits';
import { isNumber, isRecord, isString, optionalWithinChars, withinChars } from './helpers';
import { validateConnectorEnd, validatePointsArray, validateWhiteboardObject } from './objectValidation';
import type { ValidationResult } from './types';

export function validateBoardEvent(v: unknown, expectedBoardId?: string): ValidationResult<BoardEvent> {
  if (!isRecord(v)) return { ok: false, error: 'op.op must be an object' };
  if (!isString(v.id) || !withinChars(v.id, MAX_CLIENT_OP_ID_CHARS)) {
    return { ok: false, error: 'op.op.id must be a string' };
  }
  if (!isString(v.boardId) || !withinChars(v.boardId, MAX_BOARD_ID_CHARS)) {
    return { ok: false, error: 'op.op.boardId must be a string' };
  }
  if (expectedBoardId && v.boardId !== expectedBoardId) {
    return { ok: false, error: 'op.op.boardId must match message.boardId' };
  }
  if (!isString(v.type)) return { ok: false, error: 'op.op.type must be a string' };
  if (!isString(v.timestamp) || !withinChars(v.timestamp, 64)) {
    return { ok: false, error: 'op.op.timestamp must be a string' };
  }
  if (v.payload === undefined || !isRecord(v.payload)) {
    return { ok: false, error: 'op.op.payload must be an object' };
  }

  if (v.type === 'objectCreated') {
    const objRes = validateWhiteboardObject(v.payload.object, 'op.op.payload.object');
    if (!objRes.ok) return objRes;
    return { ok: true, value: v as unknown as BoardEvent };
  }

  if (v.type === 'objectUpdated') {
    if (!isString(v.payload.objectId) || !withinChars(v.payload.objectId, MAX_OBJECT_ID_CHARS)) {
      return { ok: false, error: 'op.op.payload.objectId must be a short string' };
    }
    if (!isRecord(v.payload.patch)) return { ok: false, error: 'op.op.payload.patch must be an object' };

    const p = v.payload.patch as Record<string, unknown>;
    if (p.text !== undefined) {
      if (!isString(p.text)) return { ok: false, error: 'op.op.payload.patch.text must be a string' };
      if (p.text.length > MAX_TEXT_CHARS) return { ok: false, error: `op.op.payload.patch.text too long (max ${MAX_TEXT_CHARS})` };
    }
    if (p.points !== undefined) {
      const pr = validatePointsArray(p.points, 'op.op.payload.patch.points');
      if (!pr.ok) return pr;
    }
    if (p.waypoints !== undefined) {
      const pr = validatePointsArray(p.waypoints, 'op.op.payload.patch.waypoints');
      if (!pr.ok) return pr;
    }
    if (p.strokeColor !== undefined && !optionalWithinChars(p.strokeColor, MAX_COLOR_CHARS)) {
      return { ok: false, error: `op.op.payload.patch.strokeColor must be <=${MAX_COLOR_CHARS}` };
    }
    if (p.fillColor !== undefined && !optionalWithinChars(p.fillColor, MAX_COLOR_CHARS)) {
      return { ok: false, error: `op.op.payload.patch.fillColor must be <=${MAX_COLOR_CHARS}` };
    }
    if (p.textColor !== undefined && !optionalWithinChars(p.textColor, MAX_COLOR_CHARS)) {
      return { ok: false, error: `op.op.payload.patch.textColor must be <=${MAX_COLOR_CHARS}` };
    }
    if (p.strokeWidth !== undefined && (!isNumber(p.strokeWidth) || p.strokeWidth < 0 || p.strokeWidth > 200)) {
      return { ok: false, error: 'op.op.payload.patch.strokeWidth must be 0..200' };
    }
    if (p.fontSize !== undefined && (!isNumber(p.fontSize) || p.fontSize < 1 || p.fontSize > 512)) {
      return { ok: false, error: 'op.op.payload.patch.fontSize must be 1..512' };
    }
    if (p.from !== undefined) {
      const fr = validateConnectorEnd(p.from, 'op.op.payload.patch.from');
      if (!fr.ok) return fr;
    }
    if (p.to !== undefined) {
      const tr = validateConnectorEnd(p.to, 'op.op.payload.patch.to');
      if (!tr.ok) return tr;
    }

    return { ok: true, value: v as unknown as BoardEvent };
  }

  if (v.type === 'objectDeleted') {
    if (!isString(v.payload.objectId) || !withinChars(v.payload.objectId, MAX_OBJECT_ID_CHARS)) {
      return { ok: false, error: 'op.op.payload.objectId must be a short string' };
    }
    return { ok: true, value: v as unknown as BoardEvent };
  }

  if (v.type === 'selectionChanged') {
    if (!Array.isArray(v.payload.selectedIds)) return { ok: false, error: 'op.op.payload.selectedIds must be string[]' };
    if (v.payload.selectedIds.length > MAX_SELECTION_IDS) {
      return { ok: false, error: `op.op.payload.selectedIds max length ${MAX_SELECTION_IDS}` };
    }
    for (const id of v.payload.selectedIds) {
      if (!isString(id) || id.length === 0 || id.length > MAX_OBJECT_ID_CHARS) {
        return { ok: false, error: 'op.op.payload.selectedIds must contain short non-empty strings' };
      }
    }
    return { ok: true, value: v as unknown as BoardEvent };
  }

  if (v.type === 'viewportChanged') {
    if (!isRecord(v.payload.viewport)) return { ok: false, error: 'op.op.payload.viewport must be an object' };
    const vp = v.payload.viewport as Record<string, unknown>;
    if (vp.offsetX !== undefined && !isNumber(vp.offsetX)) return { ok: false, error: 'viewport.offsetX must be a number' };
    if (vp.offsetY !== undefined && !isNumber(vp.offsetY)) return { ok: false, error: 'viewport.offsetY must be a number' };
    if (vp.zoom !== undefined) {
      if (!isNumber(vp.zoom)) return { ok: false, error: 'viewport.zoom must be a number' };
      if (vp.zoom < 0.01 || vp.zoom > 100) return { ok: false, error: 'viewport.zoom out of range' };
    }
    return { ok: true, value: v as unknown as BoardEvent };
  }

  return { ok: false, error: 'op.op.type must be a supported event type' };
}
