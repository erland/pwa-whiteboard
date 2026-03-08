import React from 'react';
import { createTimerControlPayload, isTimerStatePayload, mapTimerStatePayload, type SharedTimerControlInput, type SharedTimerState } from '../../api/timerApi';
import type { WsEphemeralMessage } from '../../api/javaWhiteboardServerContract';

type UseSharedTimerArgs = {
  enabled: boolean;
  connected: boolean;
  canControl: boolean;
  lastEphemeralMessage: WsEphemeralMessage | null;
  sendEphemeral: (eventType: WsEphemeralMessage['eventType'], payload: Record<string, unknown>) => boolean;
};

export type SharedTimerViewState = {
  timer: SharedTimerState | null;
  isMutating: boolean;
  error: string | null;
  displayRemainingMs: number;
  formattedRemaining: string;
  canControl: boolean;
  canStart: boolean;
  isConnected: boolean;
  clearError: () => void;
  startTimer: (input: { durationMinutes: number; label?: string | null }) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: (durationMinutes?: number) => void;
  cancelTimer: () => void;
  completeTimer: () => void;
};

function normalizeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error || 'Shared timer action failed.');
}

function computeRemainingMs(timer: SharedTimerState | null, now: number): number {
  if (!timer) return 0;
  if (timer.state === 'running' && timer.endsAt) {
    const endsAt = new Date(timer.endsAt).getTime();
    if (!Number.isNaN(endsAt)) return Math.max(endsAt - now, 0);
  }
  return Math.max(timer.remainingMs ?? 0, 0);
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(Math.ceil(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function useSharedTimer({ enabled, connected, canControl, lastEphemeralMessage, sendEphemeral }: UseSharedTimerArgs): SharedTimerViewState {
  const [timer, setTimer] = React.useState<SharedTimerState | null>(null);
  const [isMutating, setIsMutating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!enabled) {
      setTimer(null);
      setError(null);
      setIsMutating(false);
      return;
    }
    if (!lastEphemeralMessage || lastEphemeralMessage.eventType !== 'timer-state') return;
    if (!isTimerStatePayload(lastEphemeralMessage.payload)) return;
    const nextTimer = mapTimerStatePayload(lastEphemeralMessage.payload);
    setTimer(nextTimer);
    setIsMutating(false);
    setError(null);
  }, [enabled, lastEphemeralMessage]);

  React.useEffect(() => {
    if (!timer || timer.state !== 'running') return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timer]);

  const sendControl = React.useCallback((input: SharedTimerControlInput) => {
    if (!enabled || !connected || !canControl) {
      setError('Shared timer controls require an active collaborative connection with edit access.');
      return;
    }
    setIsMutating(true);
    try {
      const payload = createTimerControlPayload(input) as Record<string, unknown>;
      const ok = sendEphemeral('timer-control', payload);
      if (!ok) {
        setIsMutating(false);
        setError('Unable to send shared timer command right now.');
      }
    } catch (e) {
      setIsMutating(false);
      setError(normalizeError(e));
    }
  }, [canControl, connected, enabled, sendEphemeral]);

  const displayRemainingMs = computeRemainingMs(timer, now);
  const currentDurationMinutes = timer ? Math.max(1, Math.round(timer.durationMs / 60000)) : undefined;

  return {
    timer,
    isMutating,
    error,
    displayRemainingMs,
    formattedRemaining: formatDuration(displayRemainingMs),
    canControl,
    canStart: !timer || timer.state === 'cancelled' || timer.state === 'completed',
    isConnected: connected,
    clearError: () => setError(null),
    startTimer: ({ durationMinutes, label }) => sendControl({
      action: 'start',
      durationMs: Math.max(1, durationMinutes) * 60_000,
      label: label ?? null,
      scope: { type: 'board' },
    }),
    pauseTimer: () => timer && sendControl({ action: 'pause', timerId: timer.timerId }),
    resumeTimer: () => timer && sendControl({ action: 'resume', timerId: timer.timerId }),
    resetTimer: (durationMinutes) => timer && sendControl({
      action: 'reset',
      timerId: timer.timerId,
      durationMs: Math.max(1, durationMinutes ?? currentDurationMinutes ?? 5) * 60_000,
      label: timer.label,
      scope: { type: timer.scope.type, ref: timer.scope.ref ?? undefined },
    }),
    cancelTimer: () => timer && sendControl({ action: 'cancel', timerId: timer.timerId }),
    completeTimer: () => timer && sendControl({ action: 'complete', timerId: timer.timerId }),
  };
}
