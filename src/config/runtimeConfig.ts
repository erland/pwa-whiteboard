export type RuntimeOidcConfig = {
  issuer?: string;
  clientId?: string;
  redirectUri?: string;
  postLogoutRedirectUri?: string;
  scope?: string;
};

export type RuntimeConfig = {
  apiBaseUrl?: string;
  wsBaseUrl?: string;
  oidc?: RuntimeOidcConfig;
};

function normalizeBasePath(basePath: string): string {
  if (!basePath) return '/';
  if (!basePath.startsWith('/')) basePath = '/' + basePath;
  if (!basePath.endsWith('/')) basePath = basePath + '/';
  return basePath;
}

/**
 * Loads optional runtime configuration from <basePath>/config.json.
 *
 * - If the file does not exist (404), returns undefined.
 * - If the request fails for other reasons, returns undefined (app still works in local-only mode).
 */
export async function loadRuntimeConfig(basePath: string): Promise<RuntimeConfig | undefined> {
  const base = normalizeBasePath(basePath);
  const url = `${base}config.json`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (res.status === 404) return undefined;
    if (!res.ok) return undefined;
    const data = (await res.json()) as RuntimeConfig;
    return data;
  } catch {
    return undefined;
  }
}
