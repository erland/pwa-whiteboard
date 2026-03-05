/**
 * Whiteboard server base URL configuration.
 *
 * Preferred configuration:
 *   - VITE_API_BASE_URL  (REST) e.g. https://example.org/api   OR /api (relative to current origin)
 *   - VITE_WS_BASE_URL   (WebSocket base) e.g. wss://example.org OR / (relative to current origin)
 *
 * Backward compatibility:
 *   - VITE_WHITEBOARD_SERVER_BASE_URL (legacy). If set, it is used as API base URL.
 *     If WS base URL is not provided, we derive it from API base URL by stripping a
 *     trailing "/api" segment when present.
 *
 * Notes:
 * - For WebSocket connections, the app will append "/ws/boards/{id}" to the WS base.
 *   So wsBaseUrl should usually be the *origin* (e.g. ws://host or wss://host).
 *
 * In the browser runtime these values are exposed on globalThis by src/main.tsx so
 * Jest/unit tests (which don't run Vite) can still access them.
 */

function normalizeBaseUrl(url: string): string {
  // Trim whitespace and remove trailing slashes for stable URL joining.
  return url.trim().replace(/\/+$/, '');
}

function stripTrailingSegment(url: string, segment: string): string {
  const re = new RegExp(`/${segment}$`, 'i');
  return url.replace(re, '');
}

function getOrigin(): string | undefined {
  // In browsers, window.location.origin exists.
  // In Jest, tests may set globalThis.location.origin.
  const g: any = globalThis as any;
  const origin = g?.location?.origin;
  return typeof origin === 'string' && origin.length ? origin : undefined;
}

function toWsOrigin(origin: string): string {
  if (/^wss?:\/\//i.test(origin)) return origin;
  if (/^https:\/\//i.test(origin)) return origin.replace(/^https:/i, 'wss:');
  if (/^http:\/\//i.test(origin)) return origin.replace(/^http:/i, 'ws:');
  return origin;
}

function resolveRelativeAgainstOrigin(url: string): string {
  const origin = getOrigin();
  if (!origin) return url;
  // url is expected to start with "/"
  return normalizeBaseUrl(`${origin}${url}`);
}

function resolveRelativeAgainstWsOrigin(url: string): string {
  const origin = getOrigin();
  if (!origin) return url;
  const wsOrigin = toWsOrigin(origin);
  return normalizeBaseUrl(`${wsOrigin}${url}`);
}

function readGlobal(name: string): string | undefined {
  return (globalThis as any)[name] as string | undefined;
}

export function getApiBaseUrl(): string | undefined {
  const raw =
    readGlobal('__VITE_API_BASE_URL') ??
    readGlobal('__VITE_WHITEBOARD_SERVER_BASE_URL'); // legacy

  if (!raw) return undefined;

  const normalized = normalizeBaseUrl(raw);
  if (!normalized.length) return undefined;

  if (normalized.startsWith('/')) {
    return resolveRelativeAgainstOrigin(normalized);
  }

  return normalized;
}

export function getWsBaseUrl(): string | undefined {
  const explicitRaw = readGlobal('__VITE_WS_BASE_URL');
  if (explicitRaw != null) {
    const explicit = normalizeBaseUrl(explicitRaw);
    if (!explicit.length) return undefined;

    // Accept http(s) origins too (convert to ws(s)).
    let wsBase = explicit;
    if (/^https?:\/\//i.test(wsBase)) wsBase = toWsOrigin(wsBase);

    // Accept relative values like "/" (resolve against current origin).
    if (wsBase.startsWith('/')) wsBase = resolveRelativeAgainstWsOrigin(wsBase);

    // Guard against common misconfiguration: including "/ws" in the base.
    wsBase = stripTrailingSegment(wsBase, 'ws');

    return wsBase.length ? wsBase : undefined;
  }

  const api = getApiBaseUrl();
  if (!api) return undefined;

  // Derive WS base from API base: strip "/api" then convert scheme http->ws
  let ws = stripTrailingSegment(api, 'api');

  if (/^https?:\/\//i.test(ws)) ws = toWsOrigin(ws);

  // If api was relative and we couldn't resolve origin, attempt to resolve as WS origin.
  if (ws.startsWith('/')) ws = resolveRelativeAgainstWsOrigin(ws);

  // Also guard against accidentally derived "/ws" suffix.
  ws = stripTrailingSegment(ws, 'ws');

  return ws.length ? ws : undefined;
}

export function isWhiteboardServerConfigured(): boolean {
  // REST base URL is required for the app to operate against the new backend.
  return !!getApiBaseUrl();
}

// Backward-compatible alias for older imports (prefer getApiBaseUrl)
export function getWhiteboardServerBaseUrl(): string | undefined {
  return getApiBaseUrl();
}

// Exported for tests
export const __test__ = { normalizeBaseUrl, stripTrailingSegment, toWsOrigin };
