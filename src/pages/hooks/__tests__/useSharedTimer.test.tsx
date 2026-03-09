import { renderHook, act } from '@testing-library/react';
import { useSharedTimer } from '../useSharedTimer';
import type { WsEphemeralMessage } from '../../../api/javaWhiteboardServerContract';

type HookProps = {
  enabled: boolean;
  connected: boolean;
  canControl: boolean;
  lastEphemeralMessage: WsEphemeralMessage | null;
  sendEphemeral: (eventType: string, payload: Record<string, unknown>) => boolean;
};

describe('useSharedTimer', () => {
  test('maps timer-state ephemeral messages and sends controls', () => {
    const sent: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
    const sendEphemeral = (eventType: string, payload: Record<string, unknown>) => {
      sent.push({ eventType, payload });
      return true;
    };
    const timerMessage = {
      type: 'ephemeral',
      boardId: 'board-1',
      from: 'user-1',
      eventType: 'timer-state',
      payload: {
        timerId: 'timer-1',
        state: 'paused',
        durationMs: 300000,
        remainingMs: 120000,
        updatedAt: '2026-03-08T10:00:00Z',
        createdAt: '2026-03-08T09:59:00Z',
        controllerUserId: 'user-1',
        label: 'Retro',
        scope: { type: 'board' },
      },
    } as WsEphemeralMessage;

    const { result, rerender } = renderHook((props: HookProps) => useSharedTimer(props), {
      initialProps: {
        enabled: true,
        connected: true,
        canControl: true,
        lastEphemeralMessage: null as WsEphemeralMessage | null,
        sendEphemeral,
      },
    });

    rerender({
      enabled: true,
      connected: true,
      canControl: true,
      sendEphemeral,
      lastEphemeralMessage: timerMessage,
    });

    expect(result.current.timer?.label).toBe('Retro');
    act(() => result.current.resumeTimer());
    expect(sent[0].eventType).toBe('timer-control');
    expect(sent[0].payload.action).toBe('resume');
  });

  test('clears cancelled timers from the live view state', () => {
    const sendEphemeral = () => true;
    const pausedTimerMessage = {
      type: 'ephemeral',
      boardId: 'board-1',
      from: 'user-1',
      eventType: 'timer-state',
      payload: {
        timerId: 'timer-1',
        state: 'paused',
        durationMs: 300000,
        remainingMs: 120000,
        updatedAt: '2026-03-08T10:00:00Z',
        createdAt: '2026-03-08T09:59:00Z',
        controllerUserId: 'user-1',
        label: 'Retro',
        scope: { type: 'board' },
      },
    } as WsEphemeralMessage;
    const cancelledTimerMessage = {
      type: 'ephemeral',
      boardId: 'board-1',
      from: 'user-1',
      eventType: 'timer-state',
      payload: {
        timerId: 'timer-1',
        state: 'cancelled',
        durationMs: 300000,
        remainingMs: 0,
        updatedAt: '2026-03-08T10:05:00Z',
        createdAt: '2026-03-08T09:59:00Z',
        controllerUserId: 'user-1',
        label: 'Retro',
        scope: { type: 'board' },
      },
    } as WsEphemeralMessage;

    const { result, rerender } = renderHook((props: HookProps) => useSharedTimer(props), {
      initialProps: {
        enabled: true,
        connected: true,
        canControl: true,
        lastEphemeralMessage: null as WsEphemeralMessage | null,
        sendEphemeral,
      },
    });

    rerender({
      enabled: true,
      connected: true,
      canControl: true,
      sendEphemeral,
      lastEphemeralMessage: pausedTimerMessage,
    });

    expect(result.current.timer?.label).toBe('Retro');

    rerender({
      enabled: true,
      connected: true,
      canControl: true,
      sendEphemeral,
      lastEphemeralMessage: cancelledTimerMessage,
    });

    expect(result.current.timer).toBeNull();
    expect(result.current.canStart).toBe(true);
  });

});
