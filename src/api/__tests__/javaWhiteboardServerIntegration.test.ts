import { createBoard, deleteBoard, listBoards, renameBoard } from '../boardsApi';
import { acceptInvite, createBoardInvite, validateInvite } from '../invitesApi';
import { createSnapshotsApi } from '../snapshotsApi';

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

type FetchCall = { url: string; init?: RequestInit };

describe('java whiteboard server REST contract integration', () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const originalApiBaseUrl = (globalThis as any).__VITE_API_BASE_URL;

  const fetchCalls: FetchCall[] = [];
  let fetchQueue: Array<(url: string, init?: RequestInit) => TestResponse | Promise<TestResponse>> = [];

  function installFetchQueue() {
    globalThis.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const next = fetchQueue.shift();
      if (!next) throw new Error(`Unexpected fetch call: ${String(url)}`);
      fetchCalls.push({ url: String(url), init });
      return (await next(String(url), init)) as any;
    }) as any;
  }

  beforeEach(() => {
    fetchCalls.length = 0;
    fetchQueue = [];
    (globalThis as any).__VITE_API_BASE_URL = 'http://localhost:8080/api';

    const localStorageMock = {
      getItem: jest.fn((key: string) => {
        if (key === 'wb.oidc.tokens') {
          return JSON.stringify({ access_token: 'token-123', expires_at: Date.now() + 60_000 });
        }
        if (key === 'pwa-whiteboard.boardTypeMap') {
          return null;
        }
        return null;
      }),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };

    Object.defineProperty(globalThis, 'window', {
      value: {
        location: { origin: 'http://localhost:5173' },
        localStorage: localStorageMock,
      },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true,
      writable: true,
    });

    installFetchQueue();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
    globalThis.fetch = originalFetch;
    (globalThis as any).__VITE_API_BASE_URL = originalApiBaseUrl;
    jest.restoreAllMocks();
  });

  test('covers board CRUD using the current Java server endpoint shapes', async () => {
    fetchQueue.push(
      () =>
        new TestResponse(
          JSON.stringify([
            {
              id: 'b-1',
              name: 'Existing board',
              type: 'whiteboard',
              ownerUserId: 'alice',
              status: 'active',
              createdAt: '2026-03-01T10:00:00Z',
              updatedAt: '2026-03-01T10:00:00Z',
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } }
        ),
      (_url, init) => {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
          Accept: 'application/json',
          Authorization: 'Bearer token-123',
          'Content-Type': 'application/json',
        });
        expect(init?.body).toBe(JSON.stringify({ name: 'Created board', type: 'whiteboard' }));
        return new TestResponse(
          JSON.stringify({
            id: 'b-2',
            name: 'Created board',
            type: 'whiteboard',
            ownerUserId: 'alice',
            status: 'active',
            createdAt: '2026-03-01T10:01:00Z',
            updatedAt: '2026-03-01T10:01:00Z',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      },
      (_url, init) => {
        expect(init?.method).toBe('PATCH');
        expect(init?.body).toBe(JSON.stringify({ name: 'Renamed board', type: 'whiteboard' }));
        return new TestResponse(
          JSON.stringify({
            id: 'b-2',
            name: 'Renamed board',
            type: 'whiteboard',
            ownerUserId: 'alice',
            status: 'active',
            createdAt: '2026-03-01T10:01:00Z',
            updatedAt: '2026-03-01T10:02:00Z',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      },
      (_url, init) => {
        expect(init?.method).toBe('DELETE');
        return new TestResponse(null, { status: 204 });
      }
    );

    const boards = await listBoards();
    const created = await createBoard({ name: 'Created board', boardType: 'mindmap' });
    const renamed = await renameBoard('b-2', 'Renamed board');
    await deleteBoard('b-2');

    expect(boards).toHaveLength(1);
    expect(boards[0].id).toBe('b-1');
    expect(created).toMatchObject({ id: 'b-2', boardType: 'mindmap' });
    expect(renamed).toMatchObject({ id: 'b-2', name: 'Renamed board' });

    expect(fetchCalls.map((c) => [c.url, c.init?.method])).toEqual([
      ['http://localhost:8080/api/boards', 'GET'],
      ['http://localhost:8080/api/boards', 'POST'],
      ['http://localhost:8080/api/boards/b-2', 'PATCH'],
      ['http://localhost:8080/api/boards/b-2', 'DELETE'],
    ]);
  });

  test('covers invite create validate accept flow using the current Java server endpoints', async () => {
    fetchQueue.push(
      (_url, init) => {
        expect(init?.method).toBe('POST');
        expect(init?.body).toBe(JSON.stringify({ permission: 'editor' }));
        return new TestResponse(
          JSON.stringify({
            id: 'inv-1',
            boardId: 'b-1',
            permission: 'editor',
            uses: 0,
            createdAt: '2026-03-01T10:00:00Z',
            token: 'invite-token-1',
            expiresAt: '2026-03-08T10:00:00Z',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      },
      (_url, init) => {
        expect(init?.method).toBe('POST');
        expect(init?.body).toBe(JSON.stringify({ token: 'invite-token-1' }));
        return new TestResponse(
          JSON.stringify({
            valid: true,
            reason: 'OK',
            boardId: 'b-1',
            permission: 'editor',
            expiresAt: '2026-03-08T10:00:00Z',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      },
      (_url, init) => {
        expect(init?.method).toBe('POST');
        expect(init?.body).toBe(JSON.stringify({ token: 'invite-token-1' }));
        return new TestResponse(null, { status: 204 });
      }
    );

    const created = await createBoardInvite({ boardId: 'b-1', permission: 'EDITOR' });
    const validated = await validateInvite('invite-token-1');
    await acceptInvite('invite-token-1');

    expect(created).toMatchObject({ token: 'invite-token-1', expiresAt: '2026-03-08T10:00:00Z' });
    expect(validated).toEqual({
      valid: true,
      reason: 'OK',
      boardId: 'b-1',
      permission: 'editor',
      expiresAt: '2026-03-08T10:00:00Z',
    });

    expect(fetchCalls.map((c) => [c.url, c.init?.method])).toEqual([
      ['http://localhost:8080/api/boards/b-1/invites', 'POST'],
      ['http://localhost:8080/api/invites/validate', 'POST'],
      ['http://localhost:8080/api/invites/accept', 'POST'],
    ]);
  });

  test('covers snapshot list getLatest create flow using the current Java server endpoints', async () => {
    const api = createSnapshotsApi({ baseUrl: 'http://localhost:8080/api', accessToken: 'token-xyz' });

    fetchQueue.push(
      (_url, init) => {
        expect(init?.method).toBe('GET');
        expect(init?.headers).toMatchObject({
          Accept: 'application/json',
          Authorization: 'Bearer token-xyz',
        });
        return new TestResponse(JSON.stringify({ versions: [1, 4, 3] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
      (_url, init) => {
        expect(init?.method).toBe('GET');
        return new TestResponse(
          JSON.stringify({
            boardId: 'b-7',
            version: 4,
            snapshot: { objects: [], boardType: 'advanced' },
            createdAt: '2026-03-01T10:05:00Z',
            createdBy: 'alice',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      },
      (_url, init) => {
        expect(init?.method).toBe('POST');
        expect(init?.body).toBe(JSON.stringify({ snapshot: { objects: [], boardType: 'freehand' } }));
        return new TestResponse(
          JSON.stringify({
            boardId: 'b-7',
            version: 5,
            snapshot: { objects: [], boardType: 'freehand' },
            createdAt: '2026-03-01T10:06:00Z',
            createdBy: 'alice',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
    );

    const latest = await api.getLatest('b-7');
    const created = await api.create('b-7', JSON.stringify({ objects: [], boardType: 'freehand' }));

    expect(latest?.version).toBe(4);
    expect(created.version).toBe(5);

    expect(fetchCalls.map((c) => [c.url, c.init?.method])).toEqual([
      ['http://localhost:8080/api/boards/b-7/snapshots', 'GET'],
      ['http://localhost:8080/api/boards/b-7/snapshots/4', 'GET'],
      ['http://localhost:8080/api/boards/b-7/snapshots', 'POST'],
    ]);
  });
});
