type Discovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string;
};

const LS_PREFIX = 'wb.oidc.';
const LS_DISCOVERY = `${LS_PREFIX}discovery`;
const LS_TOKENS = `${LS_PREFIX}tokens`;
const LS_PKCE = `${LS_PREFIX}pkce`;

type Tokens = {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_at: number; // epoch ms
  token_type?: string;
  scope?: string;
};

function getEnv() {
  const issuer = (globalThis as any).__VITE_OIDC_ISSUER as string | undefined;
  const clientId = (globalThis as any).__VITE_OIDC_CLIENT_ID as string | undefined;
  const redirectUri =
    ((globalThis as any).__VITE_OIDC_REDIRECT_URI as string | undefined) ||
    (typeof window !== 'undefined' ? `${window.location.origin}${(globalThis as any).__VITE_BASE_URL || '/'}` : undefined);
  const postLogoutRedirectUri =
    ((globalThis as any).__VITE_OIDC_POST_LOGOUT_REDIRECT_URI as string | undefined) ||
    (typeof window !== 'undefined' ? `${window.location.origin}${(globalThis as any).__VITE_BASE_URL || '/'}` : undefined);
  const scope = ((globalThis as any).__VITE_OIDC_SCOPE as string | undefined) || 'openid profile email';
  return { issuer, clientId, redirectUri, postLogoutRedirectUri, scope };
}

export function isOidcConfigured(): boolean {
  const { issuer, clientId, redirectUri } = getEnv();
  return Boolean(issuer && clientId && redirectUri);
}

function normalizeIssuer(issuer: string): string {
  return issuer.endsWith('/') ? issuer.slice(0, -1) : issuer;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`OIDC discovery fetch failed: ${res.status}`);
  return (await res.json()) as T;
}

async function getDiscovery(): Promise<Discovery> {
  const cached = localStorage.getItem(LS_DISCOVERY);
  const { issuer } = getEnv();
  if (!issuer) throw new Error('OIDC issuer not configured');
  const norm = normalizeIssuer(issuer);

  if (cached) {
    try {
      const parsed = JSON.parse(cached) as { issuer: string; discovery: Discovery };
      if (parsed.issuer === norm) return parsed.discovery;
    } catch {
      // ignore
    }
  }

  const url = `${norm}/.well-known/openid-configuration`;
  const discovery = await fetchJson<Discovery>(url);
  localStorage.setItem(LS_DISCOVERY, JSON.stringify({ issuer: norm, discovery }));
  return discovery;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  const b64 = btoa(s);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomString(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64UrlEncode(buf);
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function setPkce(payload: any) {
  localStorage.setItem(LS_PKCE, JSON.stringify(payload));
}
function getPkce(): any | null {
  const raw = localStorage.getItem(LS_PKCE);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function clearPkce() {
  localStorage.removeItem(LS_PKCE);
}

function setTokens(t: Tokens) {
  localStorage.setItem(LS_TOKENS, JSON.stringify(t));
}
function getTokens(): Tokens | null {
  const raw = localStorage.getItem(LS_TOKENS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Tokens;
  } catch {
    return null;
  }
}
export function clearTokens() {
  localStorage.removeItem(LS_TOKENS);
}

export function getAccessToken(): string | null {
  const t = getTokens();
  if (!t) return null;
  // give a small skew to avoid edge expiration
  if (Date.now() > t.expires_at - 10_000) return null;
  return t.access_token;
}

export function getIdToken(): string | null {
  const t = getTokens();
  if (!t?.id_token) return null;
  return t.id_token;
}

export function hasValidSession(): boolean {
  return Boolean(getAccessToken());
}

export async function startLogin(): Promise<void> {
  const { issuer, clientId, redirectUri, scope } = getEnv();
  if (!issuer || !clientId || !redirectUri) {
    throw new Error('OIDC not configured');
  }

  const discovery = await getDiscovery();

  const state = randomString(24);
  const nonce = randomString(24);
  const codeVerifier = randomString(48);
  const codeChallenge = await sha256Base64Url(codeVerifier);

  setPkce({ state, nonce, codeVerifier, createdAt: Date.now() });

  const url = new URL(discovery.authorization_endpoint);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  window.location.assign(url.toString());
}

function parseCallbackParams(): { code?: string; state?: string; error?: string; error_description?: string } {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  const code = params.get('code') ?? undefined;
  const state = params.get('state') ?? undefined;
  const error = params.get('error') ?? undefined;
  const error_description = params.get('error_description') ?? undefined;
  return { code, state, error, error_description };
}

function cleanUrlAfterCallback() {
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('error');
  url.searchParams.delete('error_description');
  // Keep other params (like invite) intact.
  window.history.replaceState({}, document.title, url.toString());
}

export async function handleLoginRedirectCallbackIfPresent(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const { code, state, error, error_description } = parseCallbackParams();
  if (!code && !error) return false;

  const pkce = getPkce();
  try {
    if (error) throw new Error(error_description || error);

    if (!pkce?.state || pkce.state !== state) {
      throw new Error('OIDC state mismatch');
    }

    const { clientId, redirectUri } = getEnv();
    if (!clientId || !redirectUri) throw new Error('OIDC not configured');

    const discovery = await getDiscovery();

    const body = new URLSearchParams();
    body.set('grant_type', 'authorization_code');
    body.set('code', code!);
    body.set('redirect_uri', redirectUri);
    body.set('client_id', clientId);
    body.set('code_verifier', pkce.codeVerifier);

    const res = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`OIDC token exchange failed: ${res.status} ${txt}`);
    }

    const json = (await res.json()) as any;
    const expiresIn = Number(json.expires_in ?? 0);
    const expiresAt = Date.now() + Math.max(expiresIn, 0) * 1000;

    const tokens: Tokens = {
      access_token: String(json.access_token),
      id_token: json.id_token ? String(json.id_token) : undefined,
      refresh_token: json.refresh_token ? String(json.refresh_token) : undefined,
      token_type: json.token_type ? String(json.token_type) : undefined,
      scope: json.scope ? String(json.scope) : undefined,
      expires_at: expiresAt,
    };

    if (!tokens.access_token) throw new Error('OIDC did not return an access_token');

    setTokens(tokens);
    return true;
  } finally {
    clearPkce();
    cleanUrlAfterCallback();
  }
}

export async function startLogout(): Promise<void> {
  clearTokens();

  const { postLogoutRedirectUri } = getEnv();
  const idToken = getIdToken();

  try {
    const discovery = await getDiscovery();
    if (discovery.end_session_endpoint && idToken) {
      const url = new URL(discovery.end_session_endpoint);
      url.searchParams.set('id_token_hint', idToken);
      if (postLogoutRedirectUri) url.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);
      window.location.assign(url.toString());
      return;
    }
  } catch {
    // ignore and just navigate home
  }

  if (postLogoutRedirectUri) window.location.assign(postLogoutRedirectUri);
}
