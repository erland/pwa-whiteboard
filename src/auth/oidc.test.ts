import { clearTokens, startLogout } from './oidc';

describe('oidc logout', () => {
  const originalFetch = global.fetch;
  const originalLocation = window.location;
  let assignMock: jest.Mock<void, [string]>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    assignMock = jest.fn<void, [string]>();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        origin: 'https://app.example.com',
        assign: assignMock,
      },
    });

    (globalThis as any).__VITE_OIDC_ISSUER = 'https://kc.example.com/realms/test';
    (globalThis as any).__VITE_OIDC_CLIENT_ID = 'pwa-whiteboard';
    (globalThis as any).__VITE_OIDC_POST_LOGOUT_REDIRECT_URI = 'https://app.example.com/';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    clearTokens();
    delete (globalThis as any).__VITE_OIDC_ISSUER;
    delete (globalThis as any).__VITE_OIDC_CLIENT_ID;
    delete (globalThis as any).__VITE_OIDC_POST_LOGOUT_REDIRECT_URI;
  });

  it('redirects to the provider logout endpoint with the stored id token hint', async () => {
    localStorage.setItem(
      'wb.oidc.tokens',
      JSON.stringify({
        access_token: 'access-token',
        id_token: 'id-token-123',
        expires_at: Date.now() + 60_000,
      })
    );

    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        authorization_endpoint: 'https://kc.example.com/realms/test/protocol/openid-connect/auth',
        token_endpoint: 'https://kc.example.com/realms/test/protocol/openid-connect/token',
        end_session_endpoint: 'https://kc.example.com/realms/test/protocol/openid-connect/logout',
      }),
    } as Response));

    await startLogout();

    expect(assignMock).toHaveBeenCalledTimes(1);
    const redirectUrl = new URL(assignMock.mock.calls[0][0]);
    expect(redirectUrl.origin + redirectUrl.pathname).toBe(
      'https://kc.example.com/realms/test/protocol/openid-connect/logout'
    );
    expect(redirectUrl.searchParams.get('id_token_hint')).toBe('id-token-123');
    expect(redirectUrl.searchParams.get('client_id')).toBe('pwa-whiteboard');
    expect(redirectUrl.searchParams.get('post_logout_redirect_uri')).toBe('https://app.example.com/');
    expect(localStorage.getItem('wb.oidc.tokens')).toBeNull();
  });

  it('falls back to the configured post-logout redirect when discovery has no logout endpoint', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        authorization_endpoint: 'https://kc.example.com/realms/test/protocol/openid-connect/auth',
        token_endpoint: 'https://kc.example.com/realms/test/protocol/openid-connect/token',
      }),
    } as Response));

    await startLogout();

    expect(assignMock).toHaveBeenCalledWith('https://app.example.com/');
  });
});
