export type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly url: string;
  readonly body: unknown;

  constructor(args: { status: number; statusText: string; url: string; body: unknown }) {
    super(`HTTP ${args.status} ${args.statusText}`);
    this.name = 'ApiError';
    this.status = args.status;
    this.statusText = args.statusText;
    this.url = args.url;
    this.body = args.body;
  }
}

export type AccessTokenProvider = () => Promise<string | null> | string | null;

export type CreateHttpClientArgs = {
  /** Base URL without a trailing path, e.g. https://example.org/api */
  baseUrl: string;
  /** Return an access token to send as "Authorization: Bearer <token>" */
  getAccessToken?: AccessTokenProvider;
  /** Called when the server responds 401/403 */
  onUnauthorized?: () => void;
};

export type RequestArgs = {
  method: string;
  path: string;
  headers?: Record<string, string>;
  /** JSON body – automatically stringified and sets Content-Type */
  json?: JsonValue;
  /** Raw body – used as-is (no Content-Type changes) */
  body?: BodyInit | null;
  signal?: AbortSignal;
};

export type HttpClient = {
  request<T = unknown>(args: RequestArgs): Promise<T>;
  get<T = unknown>(path: string, args?: Omit<RequestArgs, 'method' | 'path' | 'json' | 'body'>): Promise<T>;
  post<T = unknown>(path: string, args?: Omit<RequestArgs, 'method' | 'path'>): Promise<T>;
  put<T = unknown>(path: string, args?: Omit<RequestArgs, 'method' | 'path'>): Promise<T>;
  del<T = unknown>(path: string, args?: Omit<RequestArgs, 'method' | 'path' | 'json'>): Promise<T>;
};

function joinUrl(baseUrl: string, path: string): string {
  // If path is absolute, don't try to join
  if (/^https?:\/\//i.test(path)) return path;

  const base = baseUrl.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

async function readBody(response: Response): Promise<unknown> {
  // 204 No Content etc.
  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
}

export function createHttpClient(args: CreateHttpClientArgs): HttpClient {
  const { baseUrl, getAccessToken, onUnauthorized } = args;

  async function request<T>(req: RequestArgs): Promise<T> {
    const url = joinUrl(baseUrl, req.path);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(req.headers ?? {})
    };

    const token = getAccessToken ? await getAccessToken() : null;
    if (typeof token === 'string' && token.trim().length > 0) {
      headers.Authorization = `Bearer ${token}`;
      // Some proxies/middleware can be picky about header casing.
      headers.authorization = headers.Authorization;
    }

    let body: BodyInit | null | undefined = req.body;
    if (req.json !== undefined) {
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
      body = JSON.stringify(req.json);
    }

    const res = await fetch(url, {
      method: req.method,
      headers,
      body,
      signal: req.signal
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) onUnauthorized?.();
      const errBody = await readBody(res);
      throw new ApiError({ status: res.status, statusText: res.statusText, url, body: errBody });
    }

    // Allow callers to use request<void>() for endpoints with no body.
    if (res.status === 204) return undefined as T;
    const data = await readBody(res);
    return data as T;
  }

  return {
    request,
    get: (path, a) => request({ method: 'GET', path, ...(a ?? {}) }),
    post: (path, a) => request({ method: 'POST', path, ...(a ?? {}) }),
    put: (path, a) => request({ method: 'PUT', path, ...(a ?? {}) }),
    del: (path, a) => request({ method: 'DELETE', path, ...(a ?? {}) })
  };
}