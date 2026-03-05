/**
 * Whiteboard server base URL configuration.
 *
 * New configuration (preferred):
 *   - VITE_API_BASE_URL  (REST) e.g. https://example.org/api
 *   - VITE_WS_BASE_URL   (WebSocket) e.g. wss://example.org
 *
 * Backward compatibility:
 *   - VITE_WHITEBOARD_SERVER_BASE_URL (legacy). If set, it is used as API base URL.
 *     If WS base URL is not provided, we derive it from API base URL by stripping a
 *     trailing "/api" segment when present.
 *
 * In the browser runtime these values are exposed on globalThis by src/main.tsx so
 * Jest/unit tests (which don't run Vite) can still access them.
 */

function normalizeBaseUrl(url: string): string {
  // Trim whitespace and remove trailing slashes for stable URL joining.
  return url.trim().replace(/\/+$/, '');
}

function stripTrailingApiSegment(url: string): string {
  // If API base is ".../api", derive WS base as "..." (common server routing).
  return url.replace(/\/api$/i, '');
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
  return normalized.length ? normalized : undefined;
}

export function getWsBaseUrl(): string | undefined {
  const explicit = readGlobal('__VITE_WS_BASE_URL');
  if (explicit) {
    const normalized = normalizeBaseUrl(explicit);
    return normalized.length ? normalized : undefined;
  }

  const api = getApiBaseUrl();
  if (!api) return undefined;
  return stripTrailingApiSegment(api);
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
export const __test__ = { normalizeBaseUrl, stripTrailingApiSegment };
