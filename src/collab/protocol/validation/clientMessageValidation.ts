import type { ClientToServerMessage } from '../types';
import { MAX_CLIENT_OP_ID_CHARS } from '../limits';
import { isInt, isRecord, isString, withinChars } from './helpers';
import { validateBoardEvent } from './eventValidation';
import type { ValidationResult } from './types';

export function validateClientToServerMessage(v: unknown): ValidationResult<ClientToServerMessage> {
  if (!isRecord(v)) return { ok: false, error: 'message must be an object' };
  if (!isString(v.type)) return { ok: false, error: 'message.type must be a string' };

  if (v.type === 'op') {
    if (v.clientOpId !== undefined && (!isString(v.clientOpId) || !withinChars(v.clientOpId, MAX_CLIENT_OP_ID_CHARS))) {
      return { ok: false, error: `op.clientOpId must be <=${MAX_CLIENT_OP_ID_CHARS}` };
    }
    if (v.baseSeq !== undefined && (!isInt(v.baseSeq) || v.baseSeq < 0)) {
      return { ok: false, error: 'op.baseSeq must be a non-negative integer' };
    }
    const opRes = validateBoardEvent(v.op);
    if (!opRes.ok) return opRes;
    return {
      ok: true,
      value: {
        type: 'op',
        clientOpId: v.clientOpId as string | undefined,
        baseSeq: v.baseSeq as number | undefined,
        op: opRes.value,
      },
    };
  }

  if (v.type === 'ping') {
    if (!isInt(v.t)) return { ok: false, error: 'ping.t must be an integer' };
    return { ok: true, value: { type: 'ping', t: v.t } };
  }

  return { ok: false, error: `unknown message.type: ${String(v.type)}` };
}
