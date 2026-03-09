import {
  MAX_BOARD_ID_CHARS,
  MAX_CLIENT_OP_ID_CHARS,
  MAX_USER_ID_CHARS,
} from '../limits';
import type { PresencePayload, PresenceUser, ServerToClientMessage } from '../types';
import { isInt, isRecord, isString, normalizeBoardRole, withinChars } from './helpers';
import { validateBoardEvent } from './eventValidation';
import { validatePresencePayload, validatePresenceUser } from './presenceValidation';
import type { ValidationResult } from './types';

function validatePresentUserIds(v: unknown, label: string): ValidationResult<string[] | undefined> {
  if (v === undefined) return { ok: true, value: undefined };
  if (!Array.isArray(v)) return { ok: false, error: `${label} must be an array` };
  for (const id of v) {
    if (!isString(id) || !withinChars(id, MAX_USER_ID_CHARS)) {
      return { ok: false, error: `${label} must contain strings <=${MAX_USER_ID_CHARS}` };
    }
  }
  return { ok: true, value: v as string[] };
}

function validateUsersArray(v: unknown, label: string): ValidationResult<PresenceUser[] | undefined> {
  if (v === undefined) return { ok: true, value: undefined };
  if (!Array.isArray(v)) return { ok: false, error: `${label} must be an array` };

  const users: PresenceUser[] = [];
  for (const u of v) {
    if (isRecord(u) && isString((u as any).userId)) {
      const maybePresence = validatePresenceUser(u);
      if (maybePresence.ok) {
        users.push(maybePresence.value);
      } else {
        const id = (u as any).userId as string;
        if (!withinChars(id, MAX_USER_ID_CHARS)) return { ok: false, error: `${label}.userId too long` };
        users.push({ userId: id, displayName: id, role: 'viewer' });
      }
    } else {
      return { ok: false, error: `${label} items must be objects with userId` };
    }
  }

  return { ok: true, value: users };
}

function validatePresenceByUserId(v: unknown): ValidationResult<Record<string, PresencePayload> | undefined> {
  if (v === undefined) return { ok: true, value: undefined };
  if (!isRecord(v)) return { ok: false, error: 'presence.presenceByUserId must be an object' };

  const presenceByUserId: Record<string, PresencePayload> = {};
  for (const [k, pv] of Object.entries(v)) {
    if (!withinChars(k, MAX_USER_ID_CHARS)) return { ok: false, error: 'presenceByUserId keys must be short user ids' };
    const pr = validatePresencePayload(pv);
    if (!pr.ok) return { ok: false, error: `presenceByUserId[${k}]: ${pr.error}` };
    presenceByUserId[k] = pr.value;
  }
  return { ok: true, value: presenceByUserId };
}

function validateJoinedMessage(v: Record<string, unknown>): ValidationResult<ServerToClientMessage> {
  if (!isString(v.boardId) || !withinChars(v.boardId, MAX_BOARD_ID_CHARS)) {
    return { ok: false, error: `joined.boardId must be a non-empty string (<=${MAX_BOARD_ID_CHARS})` };
  }

  const rawUserId = (v as any).userId ?? (v as any).yourUserId;
  if (!isString(rawUserId) || !withinChars(rawUserId, MAX_USER_ID_CHARS)) {
    return { ok: false, error: `joined.userId must be a non-empty string (<=${MAX_USER_ID_CHARS})` };
  }

  const rawRole = (v as any).role ?? (v as any).permission;
  const role = rawRole !== undefined ? normalizeBoardRole(rawRole) : 'editor';
  if (!role) return { ok: false, error: 'joined.role must be owner|editor|viewer' };

  const presentUserIdsRes = validatePresentUserIds(v.presentUserIds, 'joined.presentUserIds');
  if (!presentUserIdsRes.ok) return presentUserIdsRes;

  const usersRes = validateUsersArray((v as any).users, 'joined.users');
  if (!usersRes.ok) return usersRes;

  return {
    ok: true,
    value: {
      type: 'joined',
      boardId: v.boardId,
      userId: rawUserId,
      role,
      presentUserIds: presentUserIdsRes.value,
      snapshot: (v as any).snapshot,
      latestSnapshot: (v as any).latestSnapshot,
      serverNow: (v as any).serverNow,
      users: usersRes.value,
    },
  };
}

function validateOpMessage(v: Record<string, unknown>): ValidationResult<ServerToClientMessage> {
  if (v.boardId !== undefined && (!isString(v.boardId) || !withinChars(v.boardId, MAX_BOARD_ID_CHARS))) {
    return { ok: false, error: `op.boardId must be <=${MAX_BOARD_ID_CHARS}` };
  }
  if (!isInt(v.seq) || v.seq < 0) return { ok: false, error: 'op.seq must be a non-negative integer' };
  const rawAuthorId = (v as any).authorId ?? (v as any).from;
  if (rawAuthorId !== undefined && (!isString(rawAuthorId) || !withinChars(rawAuthorId, MAX_USER_ID_CHARS))) {
    return { ok: false, error: `op.authorId must be <=${MAX_USER_ID_CHARS}` };
  }
  if (v.clientOpId !== undefined && (!isString(v.clientOpId) || v.clientOpId.length > MAX_CLIENT_OP_ID_CHARS)) {
    return { ok: false, error: `op.clientOpId must be <=${MAX_CLIENT_OP_ID_CHARS}` };
  }
  if (v.op === undefined) return { ok: false, error: 'op.op is required' };
  const opRes = validateBoardEvent(v.op);
  if (!opRes.ok) return opRes;

  return {
    ok: true,
    value: {
      type: 'op',
      boardId: v.boardId as string | undefined,
      seq: v.seq,
      op: opRes.value,
      authorId: rawAuthorId as string | undefined,
      clientOpId: v.clientOpId as string | undefined,
    },
  };
}

function validatePresenceMessage(v: Record<string, unknown>): ValidationResult<ServerToClientMessage> {
  if (v.boardId !== undefined && (!isString(v.boardId) || !withinChars(v.boardId, MAX_BOARD_ID_CHARS))) {
    return { ok: false, error: `presence.boardId must be <=${MAX_BOARD_ID_CHARS}` };
  }

  const usersRes = validateUsersArray((v as any).users, 'presence.users');
  if (!usersRes.ok) return usersRes;

  const presentUserIdsRes = validatePresentUserIds(v.presentUserIds, 'presence.presentUserIds');
  if (!presentUserIdsRes.ok) return presentUserIdsRes;

  const presenceByUserIdRes = validatePresenceByUserId(v.presenceByUserId);
  if (!presenceByUserIdRes.ok) return presenceByUserIdRes;

  return {
    ok: true,
    value: {
      type: 'presence',
      boardId: v.boardId as string | undefined,
      presentUserIds: presentUserIdsRes.value,
      users: usersRes.value,
      presenceByUserId: presenceByUserIdRes.value,
    },
  };
}

function validateErrorMessage(v: Record<string, unknown>): ValidationResult<ServerToClientMessage> {
  if (!isString(v.code)) return { ok: false, error: 'error.code must be a string' };
  if (!isString(v.message) || v.message.length === 0) return { ok: false, error: 'error.message must be non-empty string' };
  if (v.boardId !== undefined && (!isString(v.boardId) || v.boardId.length > MAX_BOARD_ID_CHARS)) {
    return { ok: false, error: `error.boardId must be <=${MAX_BOARD_ID_CHARS}` };
  }
  if (v.fatal !== undefined && typeof v.fatal !== 'boolean') {
    return { ok: false, error: 'error.fatal must be boolean' };
  }
  return { ok: true, value: { type: 'error', boardId: v.boardId as any, code: v.code as any, message: v.message, fatal: v.fatal as any } };
}

function validatePongMessage(v: Record<string, unknown>): ValidationResult<ServerToClientMessage> {
  if (!isInt(v.t)) return { ok: false, error: 'pong.t must be an integer' };
  return { ok: true, value: { type: 'pong', t: v.t } };
}

export function validateServerToClientMessage(v: unknown): ValidationResult<ServerToClientMessage> {
  if (!isRecord(v)) return { ok: false, error: 'message must be an object' };
  if (!isString(v.type)) return { ok: false, error: 'message.type must be a string' };

  if (v.type === 'joined') return validateJoinedMessage(v);
  if (v.type === 'op') return validateOpMessage(v);
  if (v.type === 'presence') return validatePresenceMessage(v);
  if (v.type === 'error') return validateErrorMessage(v);
  if (v.type === 'pong') return validatePongMessage(v);

  return { ok: false, error: `unknown message.type: ${String(v.type)}` };
}
