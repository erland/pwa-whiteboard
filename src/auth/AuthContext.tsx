import React from 'react';
import { handleLoginRedirectCallbackIfPresent, hasValidSession, isOidcConfigured, startLogin, startLogout, getAccessToken, getIdToken } from './oidc';
import { decodeJwtClaims, getDisplayNameFromClaims } from './jwt';

export type AuthState = {
  configured: boolean;
  authenticated: boolean;
  accessToken: string | null;
  displayName: string | null;
  subject: string | null;
};

type AuthApi = AuthState & {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshFromStorage: () => void;
};

const AuthContext = React.createContext<AuthApi | null>(null);

function buildState(): AuthState {
  const configured = isOidcConfigured();
  const accessToken = getAccessToken();
  const authenticated = Boolean(accessToken) && hasValidSession();
  const idToken = getIdToken();
  const claims = idToken ? decodeJwtClaims(idToken) : null;
  const displayName = getDisplayNameFromClaims(claims);
  const subj = (claims && typeof (claims as any)['sub'] === 'string') ? String((claims as any)['sub']) : null;
  return { configured, authenticated, accessToken, displayName, subject: subj };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>(() => buildState());

  const POST_LOGIN_REDIRECT_KEY = 'pwa-whiteboard.postLoginRedirect';

  React.useEffect(() => {
    // Handle OIDC redirect callback if present (code -> tokens)
    handleLoginRedirectCallbackIfPresent()
      .then((handled) => {
        if (handled) {
          setState(buildState());
          try {
            const target = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
            if (target) {
              sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
              // Avoid infinite loops; only redirect if we're not already at target.
              if (typeof window !== 'undefined' && window.location.href !== target) {
                window.location.replace(target);
              }
            }
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        // ignore; UI can show unauthenticated
      });
  }, []);

  const api: AuthApi = React.useMemo(
    () => ({
      ...state,
      login: async () => {
        await startLogin();
      },
      logout: async () => {
        await startLogout();
      },
      refreshFromStorage: () => setState(buildState()),
    }),
    [state]
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
