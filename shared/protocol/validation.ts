import {
  MAX_BOARD_ID_CHARS,
  MAX_CLIENT_OP_ID_CHARS,
  MAX_COLOR_CHARS,
  MAX_DISPLAY_NAME_CHARS,
  MAX_MESSAGE_BYTES,
  MAX_SELECTION_IDS,
  MAX_TOKEN_CHARS,
  MAX_USER_ID_CHARS,
} from './limits';
import type {
  BoardRole,
  ClientToServerMessage,
  JoinAuth,
  PresencePayload,
  PresenceUser,
  ServerToClientMessage,
} from './types';

export type ValidationOk<T> = { ok: true; value: T };
export type ValidationErr = { ok: false; error: string };
export type ValidationResult<T> = ValidationOk<T> | ValidationErr;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isInt(v: unknown): v is number {
  return isNumber(v) && Number.isInteger(v);
}

function isBoardRole(v: unknown): v is BoardRole {
  return v === 'owner' || v === 'editor' || v === 'viewer';
}

function withinChars(s: string, max: number): boolean {
  return s.length > 0 && s.length <= max;
}

function optionalWithinChars(s: unknown, max: number): boolean {
  return s === undefined || (isString(s) && s.length <= max);
}

function validatePresencePayload(v: unknown): ValidationResult<PresencePayload> {
  if (!isRecord(v)) return { ok: false, error: 'presence must be an object' };

  const out: PresencePayload = {};

  if (v.cursor !== undefined) {
    if (!isRecord(v.cursor) || !isNumber(v.cursor.x) || !isNumber(v.cursor.y)) {
      return { ok: false, error: 'presence.cursor must be {x:number,y:number}' };
    }
    out.cursor = { x: v.cursor.x, y: v.cursor.y };
  }

  if (v.viewport !== undefined) {
    if (
      !isRecord(v.viewport) ||
      !isNumber(v.viewport.panX) ||
      !isNumber(v.viewport.panY) ||
      !isNumber(v.viewport.zoom)
    ) {
      return {
        ok: false,
        error: 'presence.viewport must be {panX:number,panY:number,zoom:number}',
      };
    }
    out.viewport = {
      panX: v.viewport.panX,
      panY: v.viewport.panY,
      zoom: v.viewport.zoom,
    };
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

function validateJoinAuth(v: unknown): ValidationResult<JoinAuth> {
  if (!isRecord(v)) return { ok: false, error: 'auth must be an object' };
  if (!isString(v.kind)) return { ok: false, error: 'auth.kind must be a string' };

  if (v.kind === 'owner') {
    if (!isString(v.supabaseJwt) || v.supabaseJwt.length === 0) {
      return { ok: false, error: 'auth.supabaseJwt must be a non-empty string' };
    }
    if (v.supabaseJwt.length > MAX_TOKEN_CHARS) {
      return { ok: false, error: `auth.supabaseJwt too long (max ${MAX_TOKEN_CHARS})` };
    }
    return { ok: true, value: { kind: 'owner', supabaseJwt: v.supabaseJwt } };
  }

  if (v.kind === 'invite') {
    if (!isString(v.inviteToken) || v.inviteToken.length === 0) {
      return { ok: false, error: 'auth.inviteToken must be a non-empty string' };
    }
    if (v.inviteToken.length > MAX_TOKEN_CHARS) {
      return { ok: false, error: `auth.inviteToken too long (max ${MAX_TOKEN_CHARS})` };
    }
    return { ok: true, value: { kind: 'invite', inviteToken: v.inviteToken } };
  }

  return { ok: false, error: 'auth.kind must be "owner" or "invite"' };
}

/**
 * Validate a client -> server message after JSON parsing.
 */
export function validateClientToServerMessage(v: unknown): ValidationResult<ClientToServerMessage> {
  if (!isRecord(v)) return { ok: false, error: 'message must be an object' };
  if (!isString(v.type)) return { ok: false, error: 'message.type must be a string' };

  if (v.type === 'join') {
    if (!isString(v.boardId) || !withinChars(v.boardId, MAX_BOARD_ID_CHARS)) {
      return { ok: false, error: `join.boardId must be a non-empty string (<=${MAX_BOARD_ID_CHARS})` };
    }

    const authRes = validateJoinAuth(v.auth);
    if (!authRes.ok) return authRes;

    if (v.clientKnownSeq !== undefined && !isInt(v.clientKnownSeq)) {
      return { ok: false, error: 'join.clientKnownSeq must be an integer' };
    }

    if (v.client !== undefined) {
      if (!isRecord(v.client)) return { ok: false, error: 'join.client must be an object' };
      if (v.client.guestId !== undefined) {
        if (!isString(v.client.guestId) || !withinChars(v.client.guestId, MAX_USER_ID_CHARS)) {
          return { ok: false, error: `join.client.guestId must be <=${MAX_USER_ID_CHARS}` };
        }
      }
      if (!optionalWithinChars(v.client.displayName, MAX_DISPLAY_NAME_CHARS)) {
        return { ok: false, error: `join.client.displayName must be <=${MAX_DISPLAY_NAME_CHARS}` };
      }
      if (!optionalWithinChars(v.client.color, MAX_COLOR_CHARS)) {
        return { ok: false, error: `join.client.color must be <=${MAX_COLOR_CHARS}` };
      }
    }

    return {
      ok: true,
      value: {
        type: 'join',
        boardId: v.boardId,
        auth: authRes.value,
        clientKnownSeq: v.clientKnownSeq as number | undefined,
        client: v.client as any,
      },
    };
  }

  if (v.type === 'op') {
    if (!isString(v.boardId) || !withinChars(v.boardId, MAX_BOARD_ID_CHARS)) {
      return { ok: false, error: `op.boardId must be a non-empty string (<=${MAX_BOARD_ID_CHARS})` };
    }
    if (!isString(v.clientOpId) || !withinChars(v.clientOpId, MAX_CLIENT_OP_ID_CHARS)) {
      return { ok: false, error: `op.clientOpId must be a non-empty string (<=${MAX_CLIENT_OP_ID_CHARS})` };
    }
    if (!isInt(v.baseSeq) || v.baseSeq < 0) {
      return { ok: false, error: 'op.baseSeq must be a non-negative integer' };
    }
    // `op` payload is intentionally not validated at this step (Step 2 defines op type).
    if (v.op === undefined) {
      return { ok: false, error: 'op.op is required' };
    }
    return {
      ok: true,
      value: {
        type: 'op',
        boardId: v.boardId,
        clientOpId: v.clientOpId,
        baseSeq: v.baseSeq,
        op: v.op,
      },
    };
  }

  if (v.type === 'presence') {
    if (!isString(v.boardId) || !withinChars(v.boardId, MAX_BOARD_ID_CHARS)) {
      return { ok: false, error: `presence.boardId must be a non-empty string (<=${MAX_BOARD_ID_CHARS})` };
    }
    const presRes = validatePresencePayload(v.presence);
    if (!presRes.ok) return presRes;
    return { ok: true, value: { type: 'presence', boardId: v.boardId, presence: presRes.value } };
  }

  if (v.type === 'ping') {
    if (!isInt(v.t)) return { ok: false, error: 'ping.t must be an integer' };
    return { ok: true, value: { type: 'ping', t: v.t } };
  }

  return { ok: false, error: `unknown message.type: ${String(v.type)}` };
}

function validatePresenceUser(v: unknown): ValidationResult<PresenceUser> {
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
  if (!isBoardRole(v.role)) {
    return { ok: false, error: 'user.role must be owner|editor|viewer' };
  }
  return {
    ok: true,
    value: {
      userId: v.userId,
      displayName: v.displayName,
      color: v.color as string | undefined,
      role: v.role,
    },
  };
}

/**
 * Validate a server -> client message after JSON parsing.
 */
export function validateServerToClientMessage(v: unknown): ValidationResult<ServerToClientMessage> {
  if (!isRecord(v)) return { ok: false, error: 'message must be an object' };
  if (!isString(v.type)) return { ok: false, error: 'message.type must be a string' };

  if (v.type === 'joined') {
    if (!isString(v.boardId) || !withinChars(v.boardId, MAX_BOARD_ID_CHARS)) {
      return { ok: false, error: `joined.boardId must be a non-empty string (<=${MAX_BOARD_ID_CHARS})` };
    }
    if (!isBoardRole(v.role)) return { ok: false, error: 'joined.role must be owner|editor|viewer' };
    if (!isInt(v.seq) || v.seq < 0) return { ok: false, error: 'joined.seq must be a non-negative integer' };

    let users: PresenceUser[] | undefined;
    if (v.users !== undefined) {
      if (!Array.isArray(v.users)) return { ok: false, error: 'joined.users must be an array' };
      users = [];
      for (const u of v.users) {
        const res = validatePresenceUser(u);
        if (!res.ok) return { ok: false, error: `joined.users: ${res.error}` };
        users.push(res.value);
      }
    }

    if (v.snapshotSeq !== undefined && (!isInt(v.snapshotSeq) || v.snapshotSeq < 0)) {
      return { ok: false, error: 'joined.snapshotSeq must be a non-negative integer' };
    }

    return {
      ok: true,
      value: {
        type: 'joined',
        boardId: v.boardId,
        role: v.role,
        seq: v.seq,
        snapshot: v.snapshot,
        snapshotSeq: v.snapshotSeq as number | undefined,
        users,
      },
    };
  }

  if (v.type === 'op') {
    if (!isString(v.boardId) || !withinChars(v.boardId, MAX_BOARD_ID_CHARS)) {
      return { ok: false, error: `op.boardId must be a non-empty string (<=${MAX_BOARD_ID_CHARS})` };
    }
    if (!isInt(v.seq) || v.seq < 0) return { ok: false, error: 'op.seq must be a non-negative integer' };
    if (!isString(v.authorId) || !withinChars(v.authorId, MAX_USER_ID_CHARS)) {
      return { ok: false, error: `op.authorId must be a non-empty string (<=${MAX_USER_ID_CHARS})` };
    }
    if (v.clientOpId !== undefined && (!isString(v.clientOpId) || v.clientOpId.length > MAX_CLIENT_OP_ID_CHARS)) {
      return { ok: false, error: `op.clientOpId must be <=${MAX_CLIENT_OP_ID_CHARS}` };
    }
    if (v.op === undefined) return { ok: false, error: 'op.op is required' };

    return {
      ok: true,
      value: {
        type: 'op',
        boardId: v.boardId,
        seq: v.seq,
        op: v.op,
        authorId: v.authorId,
        clientOpId: v.clientOpId as string | undefined,
      },
    };
  }

  if (v.type === 'presence') {
    if (!isString(v.boardId) || !withinChars(v.boardId, MAX_BOARD_ID_CHARS)) {
      return { ok: false, error: `presence.boardId must be a non-empty string (<=${MAX_BOARD_ID_CHARS})` };
    }
    if (!Array.isArray(v.users)) return { ok: false, error: 'presence.users must be an array' };
    const users: PresenceUser[] = [];
    for (const u of v.users) {
      const res = validatePresenceUser(u);
      if (!res.ok) return { ok: false, error: `presence.users: ${res.error}` };
      users.push(res.value);
    }

    let presenceByUserId: Record<string, PresencePayload> | undefined;
    if (v.presenceByUserId !== undefined) {
      if (!isRecord(v.presenceByUserId)) return { ok: false, error: 'presence.presenceByUserId must be an object' };
      presenceByUserId = {};
      for (const [k, pv] of Object.entries(v.presenceByUserId)) {
        if (!withinChars(k, MAX_USER_ID_CHARS)) return { ok: false, error: 'presenceByUserId keys must be short user ids' };
        const pr = validatePresencePayload(pv);
        if (!pr.ok) return { ok: false, error: `presenceByUserId[${k}]: ${pr.error}` };
        presenceByUserId[k] = pr.value;
      }
    }

    return { ok: true, value: { type: 'presence', boardId: v.boardId, users, presenceByUserId } };
  }

  if (v.type === 'error') {
    if (!isString(v.code)) return { ok: false, error: 'error.code must be a string' };
    if (!isString(v.message) || v.message.length === 0) return { ok: false, error: 'error.message must be non-empty string' };
    if (v.boardId !== undefined && (!isString(v.boardId) || v.boardId.length > MAX_BOARD_ID_CHARS)) {
      return { ok: false, error: `error.boardId must be <=${MAX_BOARD_ID_CHARS}` };
    }
    if (v.fatal !== undefined && typeof v.fatal !== 'boolean') {
      return { ok: false, error: 'error.fatal must be boolean' };
    }
    // Note: code enum validation is intentionally relaxed on client side to allow future extension.
    return { ok: true, value: { type: 'error', boardId: v.boardId as any, code: v.code as any, message: v.message, fatal: v.fatal as any } };
  }

  if (v.type === 'pong') {
    if (!isInt(v.t)) return { ok: false, error: 'pong.t must be an integer' };
    return { ok: true, value: { type: 'pong', t: v.t } };
  }

  return { ok: false, error: `unknown message.type: ${String(v.type)}` };
}

export function utf8ByteLength(s: string): number {
  // Node and most JS runtimes treat string length as UTF-16 code units.
  // We need a robust UTF-8 byte length across environments.
  // Avoid referencing DOM lib types directly (shared code should compile without "dom").
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyGlobal: any = globalThis as any;
  if (anyGlobal.TextEncoder) {
    return new anyGlobal.TextEncoder().encode(s).length;
  }
  if (anyGlobal.Buffer && typeof anyGlobal.Buffer.byteLength === 'function') {
    return anyGlobal.Buffer.byteLength(s, 'utf8');
  }
  // Fallback: approximate (may under/over-count for astral symbols, but still provides a cap).
  return s.length;
}

export function parseJsonWithLimit(raw: string, maxBytes: number = MAX_MESSAGE_BYTES): ValidationResult<unknown> {
  if (utf8ByteLength(raw) > maxBytes) {
    return { ok: false, error: `message too large (max ${maxBytes} bytes)` };
  }
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
}

export function parseAndValidateClientMessage(
  raw: string,
  maxBytes: number = MAX_MESSAGE_BYTES
): ValidationResult<ClientToServerMessage> {
  const parsed = parseJsonWithLimit(raw, maxBytes);
  if (!parsed.ok) return parsed;
  return validateClientToServerMessage(parsed.value);
}

export function parseAndValidateServerMessage(
  raw: string,
  maxBytes: number = MAX_MESSAGE_BYTES
): ValidationResult<ServerToClientMessage> {
  const parsed = parseJsonWithLimit(raw, maxBytes);
  if (!parsed.ok) return parsed;
  return validateServerToClientMessage(parsed.value);
}
