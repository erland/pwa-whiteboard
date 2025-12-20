export function toWsUrl(baseUrl: string, path: string): string {
  const url = new URL(baseUrl);
  // Normalize path joining.
  const basePath = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
  const nextPath = path.startsWith('/') ? path : `/${path}`;
  url.pathname = `${basePath}${nextPath}`;

  // Switch protocol
  if (url.protocol === 'https:') url.protocol = 'wss:';
  else if (url.protocol === 'http:') url.protocol = 'ws:';

  return url.toString();
}
