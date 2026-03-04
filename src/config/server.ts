/**
 * Whiteboard server base URL configuration.
 *
 * The backend base URL is read from `VITE_WHITEBOARD_SERVER_BASE_URL`.
 * In the browser runtime it is exposed on `globalThis.__VITE_WHITEBOARD_SERVER_BASE_URL`
 * by `src/main.tsx` so Jest/unit tests (which don't run Vite) can still access it.
 */

function normalizeBaseUrl(url: string): string {
  // Trim whitespace and remove trailing slashes for stable URL joining.
  return url.trim().replace(/\/+$/, '');
}

export function getWhiteboardServerBaseUrl(): string | undefined {
  const raw = (globalThis as any).__VITE_WHITEBOARD_SERVER_BASE_URL as string | undefined;
  if (!raw) return undefined;
  const normalized = normalizeBaseUrl(raw);
  return normalized.length ? normalized : undefined;
}

export function isWhiteboardServerConfigured(): boolean {
  return !!getWhiteboardServerBaseUrl();
}

// Exported for tests
export const __test__ = { normalizeBaseUrl };
