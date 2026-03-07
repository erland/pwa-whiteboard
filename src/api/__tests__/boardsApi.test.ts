import { createBoard, deleteBoard, listBoards, renameBoard } from '../boardsApi';

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

describe('boardsApi', () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const originalApiBaseUrl = (globalThis as any).__VITE_API_BASE_URL;

  beforeEach(() => {
    (globalThis as any).__VITE_API_BASE_URL = 'http://localhost:8080/api';
    Object.defineProperty(globalThis, 'window', {
      value: {
        localStorage: {
          getItem: jest.fn(() => null),
          setItem: jest.fn(),
          removeItem: jest.fn(),
        },
      },
      configurable: true,
      writable: true,
    });
    (globalThis.fetch as unknown as jest.Mock | undefined) = undefined;
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

  test('renameBoard uses PATCH against the Java server board endpoint', async () => {
    globalThis.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe('http://localhost:8080/api/boards/b-1');
      expect(init?.method).toBe('PATCH');
      expect(init?.body).toBe(JSON.stringify({ name: 'Renamed board', type: 'whiteboard' }));
      return new TestResponse(
        JSON.stringify({
          id: 'b-1',
          name: 'Renamed board',
          type: 'whiteboard',
          ownerUserId: 'alice',
          status: 'active',
          createdAt: '2026-03-01T10:00:00Z',
          updatedAt: '2026-03-01T10:05:00Z',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ) as any;
    }) as any;

    const board = await renameBoard('b-1', 'Renamed board');
    expect(board.name).toBe('Renamed board');
    expect(board.id).toBe('b-1');
  });

  test('listBoards filters archived boards and preserves persisted board type when present', async () => {
    const localStorage = {
      getItem: jest.fn(() => JSON.stringify({ 'b-1': 'mindmap' })),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage },
      configurable: true,
      writable: true,
    });

    globalThis.fetch = jest.fn(async () => {
      return new TestResponse(
        JSON.stringify([
          {
            id: 'b-1',
            name: 'Board one',
            type: 'whiteboard',
            ownerUserId: 'alice',
            status: 'active',
            createdAt: '2026-03-01T10:00:00Z',
            updatedAt: '2026-03-01T10:00:00Z',
          },
          {
            id: 'b-2',
            name: 'Archived board',
            type: 'whiteboard',
            ownerUserId: 'alice',
            status: 'ARCHIVED',
            createdAt: '2026-03-01T10:00:00Z',
            updatedAt: '2026-03-01T10:00:00Z',
          },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ) as any;
    }) as any;

    const boards = await listBoards();
    expect(boards).toHaveLength(1);
    expect(boards[0]).toMatchObject({ id: 'b-1', boardType: 'mindmap' });
  });

  test('createBoard persists the richer client board type locally while sending the coarse server type', async () => {
    const localStorage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage },
      configurable: true,
      writable: true,
    });

    globalThis.fetch = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      expect(init?.body).toBe(JSON.stringify({ name: 'New board', type: 'whiteboard' }));
      return new TestResponse(
        JSON.stringify({
          id: 'b-3',
          name: 'New board',
          type: 'whiteboard',
          ownerUserId: 'alice',
          status: 'active',
          createdAt: '2026-03-01T10:00:00Z',
          updatedAt: '2026-03-01T10:00:00Z',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ) as any;
    }) as any;

    const board = await createBoard({ name: 'New board', boardType: 'freehand' });
    expect(board.boardType).toBe('freehand');
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'pwa-whiteboard.boardTypeMap',
      JSON.stringify({ 'b-3': 'freehand' })
    );
  });

  test('deleteBoard calls the board archive endpoint and clears the persisted board type cache', async () => {
    const localStorage = {
      getItem: jest.fn(() => JSON.stringify({ 'b-4': 'mindmap', 'b-9': 'advanced' })),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage },
      configurable: true,
      writable: true,
    });

    globalThis.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe('http://localhost:8080/api/boards/b-4');
      expect(init?.method).toBe('DELETE');
      return new TestResponse(null, { status: 204 }) as any;
    }) as any;

    await expect(deleteBoard('b-4')).resolves.toBeUndefined();
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'pwa-whiteboard.boardTypeMap',
      JSON.stringify({ 'b-9': 'advanced' })
    );
  });
});
