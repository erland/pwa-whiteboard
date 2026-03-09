import { renderHook, act } from '@testing-library/react';
import { useBoardReactions } from '../useBoardReactions';

describe('useBoardReactions', () => {
  test('sends reactions and records incoming bursts', () => {
    const sendEphemeral = jest.fn(() => true);
    const { result, rerender } = renderHook((props: any) => useBoardReactions(props), {
      initialProps: {
        enabled: true,
        canReact: true,
        selfUserId: 'me',
        lastEphemeralMessage: null,
        sendEphemeral,
      },
    });

    act(() => {
      result.current.sendReaction('👏');
    });

    expect(sendEphemeral).toHaveBeenCalledWith('reaction', { reactionType: '👏', durationMs: 2200 });
    expect(result.current.bursts.length).toBe(1);

    rerender({
      enabled: true,
      canReact: true,
      selfUserId: 'me',
      lastEphemeralMessage: {
        type: 'ephemeral',
        boardId: 'b-1',
        from: 'user-2',
        eventType: 'reaction',
        payload: { reactionType: '🎉' },
      } as any,
      sendEphemeral,
    });

    expect(result.current.bursts.some((burst: any) => burst.reactionType === '🎉')).toBe(true);
    expect(result.current.recentReactionByUserId['user-2']?.reactionType).toBe('🎉');
    expect(result.current.recentReactionByUserId['me']?.reactionType).toBe('👏');
  });
});
