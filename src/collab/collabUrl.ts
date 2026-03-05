export function toWsUrl(baseUrl: string, path: string): string {
  const url = new URL(baseUrl);

  // Split optional query string from the provided path.
  // IMPORTANT: query must NOT be placed in `url.pathname` (it will be encoded as %3F).
  const qIndex = path.indexOf('?');
  const rawPath = qIndex >= 0 ? path.slice(0, qIndex) : path;
  const rawQuery = qIndex >= 0 ? path.slice(qIndex + 1) : '';

  // Normalize path joining.
  const basePath = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
  const nextPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  url.pathname = `${basePath}${nextPath}`;

  // Apply query string (overrides any query in baseUrl).
  url.search = rawQuery ? `?${rawQuery}` : '';

  // Switch protocol
  if (url.protocol === 'https:') url.protocol = 'wss:';
  else if (url.protocol === 'http:') url.protocol = 'ws:';

  return url.toString();
}
