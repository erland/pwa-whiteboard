import { MAX_MESSAGE_BYTES } from '../limits';
import type { ClientToServerMessage, ServerToClientMessage } from '../types';
import { validateClientToServerMessage } from './clientMessageValidation';
import { validateServerToClientMessage } from './serverMessageValidation';
import type { ValidationResult } from './types';

export function utf8ByteLength(s: string): number {
  const anyGlobal: any = globalThis as any;
  if (anyGlobal.TextEncoder) {
    return new anyGlobal.TextEncoder().encode(s).length;
  }
  if (anyGlobal.Buffer && typeof anyGlobal.Buffer.byteLength === 'function') {
    return anyGlobal.Buffer.byteLength(s, 'utf8');
  }
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
