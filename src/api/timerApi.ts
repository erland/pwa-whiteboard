import type { ClientTimerControlPayload, ServerTimerScopeType, ServerTimerStatePayload } from './javaWhiteboardServerContract';

export type SharedTimerScopeType = ServerTimerScopeType;
export type SharedTimerAction = ClientTimerControlPayload['action'];

export type SharedTimerScope = {
  type: SharedTimerScopeType;
  ref: string | null;
};

export type SharedTimerState = {
  timerId: string;
  state: string;
  durationMs: number;
  remainingMs: number;
  startedAt: string | null;
  endsAt: string | null;
  updatedAt: string;
  createdAt: string;
  controllerUserId: string;
  label: string | null;
  scope: SharedTimerScope;
};

export type SharedTimerControlInput = {
  action: SharedTimerAction;
  timerId?: string;
  durationMs?: number;
  label?: string | null;
  scope?: {
    type?: SharedTimerScopeType;
    ref?: string | null;
  };
};

export function createTimerControlPayload(input: SharedTimerControlInput): ClientTimerControlPayload {
  return {
    action: input.action,
    timerId: input.timerId,
    durationMs: input.durationMs,
    label: input.label ?? undefined,
    scope: input.scope
      ? {
          type: input.scope.type ?? 'board',
          ref: input.scope.ref ?? undefined,
        }
      : undefined,
  };
}

export function mapTimerStatePayload(value: ServerTimerStatePayload): SharedTimerState {
  return {
    timerId: String(value.timerId),
    state: String(value.state),
    durationMs: Number(value.durationMs ?? 0),
    remainingMs: Number(value.remainingMs ?? 0),
    startedAt: value.startedAt ?? null,
    endsAt: value.endsAt ?? null,
    updatedAt: String(value.updatedAt),
    createdAt: String(value.createdAt),
    controllerUserId: String(value.controllerUserId),
    label: value.label ?? null,
    scope: {
      type: value.scope?.type ?? 'board',
      ref: value.scope?.ref ?? null,
    },
  };
}

export function isTimerStatePayload(value: unknown): value is ServerTimerStatePayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.timerId !== 'string') return false;
  if (typeof v.state !== 'string') return false;
  if (typeof v.durationMs !== 'number') return false;
  if (typeof v.remainingMs !== 'number') return false;
  if (typeof v.updatedAt !== 'string') return false;
  if (typeof v.createdAt !== 'string') return false;
  if (typeof v.controllerUserId !== 'string') return false;
  if (!v.scope || typeof v.scope !== 'object') return false;
  const scope = v.scope as Record<string, unknown>;
  return typeof scope.type === 'string';
}
