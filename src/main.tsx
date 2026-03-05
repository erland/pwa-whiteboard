import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import { WhiteboardProvider } from './whiteboard/WhiteboardStore';
import { AuthProvider } from './auth/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { loadRuntimeConfig } from './config/runtimeConfig';

// Expose selected Vite env vars on globalThis so non-ESM test environments (Jest) don't choke on import.meta.env
function exposeViteEnvToGlobals() {
  (globalThis as any).__VITE_API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL;
  (globalThis as any).__VITE_WS_BASE_URL = (import.meta as any).env?.VITE_WS_BASE_URL;
  // Legacy (backward compatible)
  (globalThis as any).__VITE_WHITEBOARD_SERVER_BASE_URL = (import.meta as any).env?.VITE_WHITEBOARD_SERVER_BASE_URL;

  (globalThis as any).__VITE_OIDC_ISSUER = (import.meta as any).env?.VITE_OIDC_ISSUER;
  (globalThis as any).__VITE_OIDC_CLIENT_ID = (import.meta as any).env?.VITE_OIDC_CLIENT_ID;
  (globalThis as any).__VITE_OIDC_REDIRECT_URI = (import.meta as any).env?.VITE_OIDC_REDIRECT_URI;
  (globalThis as any).__VITE_OIDC_POST_LOGOUT_REDIRECT_URI = (import.meta as any).env?.VITE_OIDC_POST_LOGOUT_REDIRECT_URI;
  (globalThis as any).__VITE_OIDC_SCOPE = (import.meta as any).env?.VITE_OIDC_SCOPE;

  (globalThis as any).__VITE_BASE_URL = (import.meta as any).env?.BASE_URL;
}

function applyRuntimeConfigToGlobals(cfg: any) {
  if (!cfg) return;

  if (typeof cfg.apiBaseUrl === 'string' && cfg.apiBaseUrl.trim().length) (globalThis as any).__VITE_API_BASE_URL = cfg.apiBaseUrl;
  if (typeof cfg.wsBaseUrl === 'string' && cfg.wsBaseUrl.trim().length) (globalThis as any).__VITE_WS_BASE_URL = cfg.wsBaseUrl;

  const oidc = cfg.oidc;
  if (oidc && typeof oidc === 'object') {
    if (typeof oidc.issuer === 'string') (globalThis as any).__VITE_OIDC_ISSUER = oidc.issuer;
    if (typeof oidc.clientId === 'string') (globalThis as any).__VITE_OIDC_CLIENT_ID = oidc.clientId;
    if (typeof oidc.redirectUri === 'string') (globalThis as any).__VITE_OIDC_REDIRECT_URI = oidc.redirectUri;
    if (typeof oidc.postLogoutRedirectUri === 'string')
      (globalThis as any).__VITE_OIDC_POST_LOGOUT_REDIRECT_URI = oidc.postLogoutRedirectUri;
    if (typeof oidc.scope === 'string') (globalThis as any).__VITE_OIDC_SCOPE = oidc.scope;
  }
}

const basename = import.meta.env.BASE_URL || '/';

async function bootstrap() {
  exposeViteEnvToGlobals();

  // Try to load runtime config (optional) from <basename>/config.json
  const runtimeCfg = await loadRuntimeConfig(basename);
  applyRuntimeConfigToGlobals(runtimeCfg);

  const rootElement = document.getElementById('root') as HTMLElement;

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <BrowserRouter basename={basename}>
        <ErrorBoundary fallbackTitle="Whiteboard crashed">
          <AuthProvider>
            <WhiteboardProvider>
              <App />
            </WhiteboardProvider>
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </React.StrictMode>
  );

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = `${import.meta.env.BASE_URL}sw.js`;
      navigator.serviceWorker.register(swUrl).catch((err) => {
        console.error('Service worker registration failed:', err);
      });
    });
  }
}

bootstrap();