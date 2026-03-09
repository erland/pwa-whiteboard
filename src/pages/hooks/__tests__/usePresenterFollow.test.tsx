import { act, renderHook } from '@testing-library/react';
import { usePresenterFollow } from '../usePresenterFollow';

describe('usePresenterFollow', () => {
  test('announces the local presenter and sends follow ephemerals', () => {
    const sendEphemeral = jest.fn(() => true);
    const applyViewport = jest.fn();
    const { result } = renderHook(() => usePresenterFollow({
      enabled: true,
      selfUserId: 'me',
      users: [{ userId: 'me', displayName: 'Me', role: 'editor' }],
      presenceByUserId: {},
      lastEphemeralMessage: null,
      sendEphemeral,
      applyViewport,
    }));

    act(() => {
      result.current.startPresenting();
    });

    expect(sendEphemeral).toHaveBeenCalledWith('follow', expect.objectContaining({ presenterUserId: 'me', active: true }));
    expect(result.current.presenterUserId).toBe('me');
  });

  test('follows remote presenter viewport updates', () => {
    const sendEphemeral = jest.fn(() => true);
    const applyViewport = jest.fn();
    const { result, rerender } = renderHook((props: any) => usePresenterFollow(props), {
      initialProps: {
        enabled: true,
        selfUserId: 'me',
        users: [
          { userId: 'me', displayName: 'Me', role: 'editor' },
          { userId: 'u-2', displayName: 'Presenter', role: 'editor' },
        ],
        presenceByUserId: {},
        lastEphemeralMessage: {
          type: 'ephemeral',
          boardId: 'b-1',
          from: 'u-2',
          eventType: 'follow',
          payload: { presenterUserId: 'u-2', active: true },
        },
        sendEphemeral,
        applyViewport,
      },
    });

    act(() => {
      result.current.followUser('u-2');
    });

    rerender({
      enabled: true,
      selfUserId: 'me',
      users: [
        { userId: 'me', displayName: 'Me', role: 'editor' },
        { userId: 'u-2', displayName: 'Presenter', role: 'editor' },
      ],
      presenceByUserId: {
        'u-2': {
          viewport: { panX: 120, panY: 80, zoom: 1.5 },
        },
      },
      lastEphemeralMessage: {
        type: 'ephemeral',
        boardId: 'b-1',
        from: 'u-2',
        eventType: 'follow',
        payload: { presenterUserId: 'u-2', active: true },
      },
      sendEphemeral,
      applyViewport,
    });

    expect(applyViewport).toHaveBeenCalledWith({ offsetX: 120, offsetY: 80, zoom: 1.5 });
  });
});
