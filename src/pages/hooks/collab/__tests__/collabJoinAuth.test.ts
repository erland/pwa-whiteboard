import { resolveCollabJoinAuth, normalizeQueryToken } from '../collabJoinAuth';

describe('collabJoinAuth', () => {
  it('normalizes access token values copied from websocket query strings', () => {
    expect(normalizeQueryToken('?access_token=abc123', 'access_token')).toBe('abc123');
    expect(normalizeQueryToken('foo=1&access_token=abc123', 'access_token')).toBe('abc123');
    expect(normalizeQueryToken('abc123', 'access_token')).toBe('abc123');
    expect(normalizeQueryToken(null, 'access_token')).toBeNull();
  });

  it('resolves authenticated join/auth state from auth context', () => {
    const resolved = resolveCollabJoinAuth({
      auth: {
        accessToken: '?access_token=token-123',
        displayName: 'Erland',
        subject: 'user-42',
      },
      guestId: 'guest-1',
      inviteParam: 'invite-123',
      boardId: 'board-1',
      apiBaseUrl: 'https://api.example.test/api',
      wsBaseUrl: 'wss://api.example.test',
    });

    expect(resolved.accessToken).toBe('token-123');
    expect(resolved.isAuthenticated).toBe(true);
    expect(resolved.inviteToken).toBeNull();
    expect(resolved.displayName).toBe('Erland');
    expect(resolved.initialSelfUserId).toBe('user-42');
    expect(resolved.restEnabled).toBe(true);
    expect(resolved.wsEnabled).toBe(true);
    expect(resolved.boardEnsured).toBe(true);
    expect(resolved.authKey).toBe('token:token-123');
  });

  it('resolves anonymous invite join state from invite token', () => {
    const resolved = resolveCollabJoinAuth({
      auth: {
        accessToken: null,
        displayName: null,
        subject: null,
      },
      guestId: 'guest-1',
      inviteParam: 'invite-123',
      boardId: 'board-1',
      apiBaseUrl: 'https://api.example.test/api',
      wsBaseUrl: 'wss://api.example.test',
    });

    expect(resolved.accessToken).toBeNull();
    expect(resolved.isAuthenticated).toBe(false);
    expect(resolved.inviteToken).toBe('invite-123');
    expect(resolved.displayName).toBe('Guest');
    expect(resolved.initialSelfUserId).toBe('guest-1');
    expect(resolved.restEnabled).toBe(false);
    expect(resolved.wsEnabled).toBe(true);
    expect(resolved.boardEnsured).toBe(true);
    expect(resolved.authKey).toBe('invite:invite-123');
  });
});
