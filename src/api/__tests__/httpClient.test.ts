import { ApiError, createHttpClient } from '../httpClient';

class TestHeaders {
  private map: Record<string, string>;
  constructor(init?: Record<string, string>) {
    this.map = {};
    if (init) {
      for (const [k, v] of Object.entries(init)) this.map[k.toLowerCase()] = String(v);
    }
  }
  get(name: string): string | null {
    const v = this.map[name.toLowerCase()];
    return v === undefined ? null : v;
  }
}

class TestResponse {
  status: number;
  statusText: string;
  ok: boolean;
  headers: TestHeaders;
  private bodyText: string | null;

  constructor(body: string | null, init: { status: number; statusText?: string; headers?: Record<string, string> }) {
    this.status = init.status;
    this.statusText = init.statusText ?? '';
    this.ok = this.status >= 200 && this.status < 300;
    this.headers = new TestHeaders(init.headers);
    this.bodyText = body;
  }

  async json(): Promise<any> {
    return this.bodyText ? JSON.parse(this.bodyText) : null;
  }

  async text(): Promise<string> {
    return this.bodyText ?? '';
  }
}

function mockFetchOnce(impl: Parameters<typeof jest.fn>[0]) {
  (globalThis.fetch as unknown as jest.Mock) = jest.fn(impl);
}

describe('createHttpClient', () => {
  beforeEach(() => {
    (globalThis.fetch as unknown as jest.Mock | undefined) = undefined;
  });

  test('joins baseUrl + path and sets Authorization header when token exists', async () => {
    mockFetchOnce(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe('https://example.org/api/boards');
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer abc' });
      return new TestResponse(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    const client = createHttpClient({
      baseUrl: 'https://example.org/api/',
      getAccessToken: () => 'abc'
    });

    const res = await client.get<{ ok: boolean }>('/boards');
    expect(res.ok).toBe(true);
  });

  test('does not set Authorization header when token is null', async () => {
    mockFetchOnce(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers.Authorization).toBeUndefined();
      return new TestResponse(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    const client = createHttpClient({ baseUrl: 'https://example.org/api', getAccessToken: () => null });
    const res = await client.get<{ ok: boolean }>('/ping');
    expect(res.ok).toBe(true);
  });

  test('stringifies json body and sets Content-Type', async () => {
    mockFetchOnce(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
      expect(init?.body).toBe(JSON.stringify({ a: 1 }));
      return new TestResponse(JSON.stringify({ id: '1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    const client = createHttpClient({ baseUrl: 'https://example.org/api' });
    const res = await client.post<{ id: string }>('/things', { json: { a: 1 } });
    expect(res.id).toBe('1');
  });


  test('supports PATCH requests for partially updating server resources', async () => {
    mockFetchOnce(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe('https://example.org/api/boards/b1');
      expect(init?.method).toBe('PATCH');
      expect(init?.body).toBe(JSON.stringify({ name: 'Renamed' }));
      return new TestResponse(JSON.stringify({ id: 'b1', name: 'Renamed' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    const client = createHttpClient({ baseUrl: 'https://example.org/api' });
    const res = await client.patch<{ id: string; name: string }>('/boards/b1', { json: { name: 'Renamed' } });
    expect(res).toEqual({ id: 'b1', name: 'Renamed' });
  });

  test('throws ApiError and calls onUnauthorized on 401/403', async () => {
    const onUnauthorized = jest.fn();

    mockFetchOnce(async () => {
      return new TestResponse(JSON.stringify({ message: 'nope' }), {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'content-type': 'application/json' }
      });
    });

    const client = createHttpClient({ baseUrl: 'https://example.org/api', onUnauthorized });

    await expect(client.get('/secure')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  test('returns undefined on 204', async () => {
    mockFetchOnce(async () => new TestResponse(null, { status: 204 }));
    const client = createHttpClient({ baseUrl: 'https://example.org/api' });

    const res = await client.post<void>('/noop');
    expect(res).toBeUndefined();
  });
});
