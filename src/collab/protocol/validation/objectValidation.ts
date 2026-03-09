import {
  MAX_COLOR_CHARS,
  MAX_OBJECT_ID_CHARS,
  MAX_STROKE_POINTS,
  MAX_TEXT_CHARS,
} from '../limits';
import { isNumber, isRecord, isString, optionalWithinChars, withinChars } from './helpers';
import type { ValidationResult } from './types';

function isWhiteboardObjectType(v: unknown): boolean {
  return (
    v === 'freehand' ||
    v === 'line' ||
    v === 'rectangle' ||
    v === 'ellipse' ||
    v === 'diamond' ||
    v === 'roundedRect' ||
    v === 'text' ||
    v === 'stickyNote' ||
    v === 'connector'
  );
}

function isArrowType(v: unknown): boolean {
  return v === 'none' || v === 'open' || v === 'closed' || v === 'filled';
}

export function validatePoint(v: unknown, label: string): ValidationResult<{ x: number; y: number }> {
  if (!isRecord(v) || !isNumber(v.x) || !isNumber(v.y)) {
    return { ok: false, error: `${label} must be {x:number,y:number}` };
  }
  return { ok: true, value: { x: v.x, y: v.y } };
}

export function validatePointsArray(v: unknown, label: string): ValidationResult<Array<{ x: number; y: number }>> {
  if (!Array.isArray(v)) return { ok: false, error: `${label} must be Point[]` };
  if (v.length > MAX_STROKE_POINTS) {
    return { ok: false, error: `${label} max length ${MAX_STROKE_POINTS}` };
  }
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < v.length; i++) {
    const pr = validatePoint(v[i], `${label}[${i}]`);
    if (!pr.ok) return pr;
    out.push(pr.value);
  }
  return { ok: true, value: out };
}

export function validateAttachment(v: unknown, label: string): ValidationResult<unknown> {
  if (!isRecord(v) || !isString(v.type)) return { ok: false, error: `${label} must be an attachment object` };
  if (v.type === 'port') {
    if (!isString(v.portId) || v.portId.length === 0 || v.portId.length > MAX_OBJECT_ID_CHARS) {
      return { ok: false, error: `${label}.portId must be a short string` };
    }
    return { ok: true, value: v };
  }
  if (v.type === 'edgeT') {
    if (v.edge !== 'top' && v.edge !== 'right' && v.edge !== 'bottom' && v.edge !== 'left') {
      return { ok: false, error: `${label}.edge must be top|right|bottom|left` };
    }
    if (!isNumber(v.t) || v.t < 0 || v.t > 1) return { ok: false, error: `${label}.t must be in [0..1]` };
    return { ok: true, value: v };
  }
  if (v.type === 'perimeterAngle') {
    if (!isNumber(v.angleRad)) return { ok: false, error: `${label}.angleRad must be a number` };
    return { ok: true, value: v };
  }
  if (v.type === 'fallback') {
    if (v.anchor !== 'center' && v.anchor !== 'top' && v.anchor !== 'right' && v.anchor !== 'bottom' && v.anchor !== 'left') {
      return { ok: false, error: `${label}.anchor must be center|top|right|bottom|left` };
    }
    return { ok: true, value: v };
  }
  return { ok: false, error: `${label}.type is invalid` };
}

export function validateConnectorEnd(v: unknown, label: string): ValidationResult<unknown> {
  if (!isRecord(v)) return { ok: false, error: `${label} must be an object` };
  if (!isString(v.objectId) || !withinChars(v.objectId, MAX_OBJECT_ID_CHARS)) {
    return { ok: false, error: `${label}.objectId must be a short string` };
  }
  const ar = validateAttachment(v.attachment, `${label}.attachment`);
  if (!ar.ok) return ar;
  return { ok: true, value: v };
}

export function validateWhiteboardObject(v: unknown, label: string): ValidationResult<any> {
  if (!isRecord(v)) return { ok: false, error: `${label} must be an object` };
  if (!isString(v.id) || !withinChars(v.id, MAX_OBJECT_ID_CHARS)) {
    return { ok: false, error: `${label}.id must be a short string` };
  }
  if (!isString(v.type) || !isWhiteboardObjectType(v.type)) {
    return { ok: false, error: `${label}.type must be a known object type` };
  }
  if (!isNumber(v.x) || !isNumber(v.y)) {
    return { ok: false, error: `${label}.x/y must be numbers` };
  }
  if (v.x2 !== undefined && !isNumber(v.x2)) return { ok: false, error: `${label}.x2 must be a number` };
  if (v.y2 !== undefined && !isNumber(v.y2)) return { ok: false, error: `${label}.y2 must be a number` };
  if (v.width !== undefined && (!isNumber(v.width) || v.width < 0)) return { ok: false, error: `${label}.width must be a non-negative number` };
  if (v.height !== undefined && (!isNumber(v.height) || v.height < 0)) return { ok: false, error: `${label}.height must be a non-negative number` };

  if (!optionalWithinChars(v.strokeColor, MAX_COLOR_CHARS)) return { ok: false, error: `${label}.strokeColor must be <=${MAX_COLOR_CHARS}` };
  if (!optionalWithinChars(v.fillColor, MAX_COLOR_CHARS)) return { ok: false, error: `${label}.fillColor must be <=${MAX_COLOR_CHARS}` };
  if (!optionalWithinChars(v.textColor, MAX_COLOR_CHARS)) return { ok: false, error: `${label}.textColor must be <=${MAX_COLOR_CHARS}` };

  if (v.strokeWidth !== undefined && (!isNumber(v.strokeWidth) || v.strokeWidth < 0 || v.strokeWidth > 200)) {
    return { ok: false, error: `${label}.strokeWidth must be 0..200` };
  }
  if (v.cornerRadius !== undefined && (!isNumber(v.cornerRadius) || v.cornerRadius < 0 || v.cornerRadius > 10_000)) {
    return { ok: false, error: `${label}.cornerRadius must be >=0` };
  }

  if (v.arrowStart !== undefined && !isArrowType(v.arrowStart)) return { ok: false, error: `${label}.arrowStart invalid` };
  if (v.arrowEnd !== undefined && !isArrowType(v.arrowEnd)) return { ok: false, error: `${label}.arrowEnd invalid` };

  if (v.fontSize !== undefined && (!isNumber(v.fontSize) || v.fontSize < 1 || v.fontSize > 512)) {
    return { ok: false, error: `${label}.fontSize must be 1..512` };
  }
  if (v.text !== undefined) {
    if (!isString(v.text)) return { ok: false, error: `${label}.text must be a string` };
    if (v.text.length > MAX_TEXT_CHARS) return { ok: false, error: `${label}.text too long (max ${MAX_TEXT_CHARS})` };
  }

  if (v.points !== undefined) {
    const pr = validatePointsArray(v.points, `${label}.points`);
    if (!pr.ok) return pr;
  }
  if (v.waypoints !== undefined) {
    const pr = validatePointsArray(v.waypoints, `${label}.waypoints`);
    if (!pr.ok) return pr;
  }

  if (v.type === 'connector') {
    if (v.from !== undefined) {
      const fr = validateConnectorEnd(v.from, `${label}.from`);
      if (!fr.ok) return fr;
    }
    if (v.to !== undefined) {
      const tr = validateConnectorEnd(v.to, `${label}.to`);
      if (!tr.ok) return tr;
    }
  }

  return { ok: true, value: v };
}
