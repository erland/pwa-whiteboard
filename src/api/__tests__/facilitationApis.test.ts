import { createCapabilitiesApi } from '../capabilitiesApi';
import { createCommentsApi } from '../commentsApi';
import { createPublicationsApi } from '../publicationsApi';
import { createVotingApi } from '../votingApi';
import { listBoardInvites, revokeBoardInvite, createBoardInvite } from '../invitesApi';
import { createTimerControlPayload, isTimerStatePayload, mapTimerStatePayload } from '../timerApi';

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

describe('facilitation API wrappers', () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const originalApiBaseUrl = (globalThis as any).__VITE_API_BASE_URL;

  beforeEach(() => {
    (globalThis as any).__VITE_API_BASE_URL = 'http://localhost:8080/api';
    const localStorageMock = {
      getItem: jest.fn((key: string) => {
        if (key === 'wb.oidc.tokens') {
          return JSON.stringify({ access_token: 'token-123', expires_at: Date.now() + 60_000 });
        }
        return null;
      }),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: localStorageMock, location: { origin: 'http://localhost:5173' } },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true,
      writable: true,
    });
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

  test('capabilities API normalizes unique capabilities', async () => {
    globalThis.fetch = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('GET');
      return new TestResponse(
        JSON.stringify({ apiVersion: '1', wsProtocolVersion: '2', capabilities: ['comments', 'comments', ' voting '] }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ) as any;
    }) as any;

    const api = createCapabilitiesApi({ baseUrl: 'http://localhost:8080/api', accessToken: 'token-123' });
    await expect(api.get()).resolves.toEqual({
      apiVersion: '1',
      wsProtocolVersion: '2',
      capabilities: ['comments', 'voting'],
    });
  });

  test('comments API wraps CRUD endpoints and maps nullable fields', async () => {
    const responses = [
      new TestResponse(
        JSON.stringify([
          {
            id: 'c-1',
            boardId: 'b-1',
            parentCommentId: null,
            targetType: 'board',
            targetRef: null,
            authorUserId: 'alice',
            content: 'Hello',
            state: 'active',
            createdAt: '2026-03-01T10:00:00Z',
            updatedAt: '2026-03-01T10:00:00Z',
            resolvedAt: null,
            deletedAt: null,
          },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ),
      new TestResponse(
        JSON.stringify({
          id: 'c-2', boardId: 'b-1', parentCommentId: null, targetType: 'object', targetRef: 'shape-1', authorUserId: 'alice',
          content: 'Pin this', state: 'active', createdAt: '2026-03-01T10:01:00Z', updatedAt: '2026-03-01T10:01:00Z', resolvedAt: null, deletedAt: null,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ),
      new TestResponse(
        JSON.stringify({
          id: 'c-2', boardId: 'b-1', parentCommentId: null, targetType: 'object', targetRef: 'shape-1', authorUserId: 'alice',
          content: 'Updated', state: 'resolved', createdAt: '2026-03-01T10:01:00Z', updatedAt: '2026-03-01T10:02:00Z', resolvedAt: '2026-03-01T10:02:00Z', deletedAt: null,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ),
    ];
    let idx = 0;
    globalThis.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (idx === 0) {
        expect(String(url)).toBe('http://localhost:8080/api/boards/b-1/comments?publicationToken=pub-token');
      } else if (idx === 1) {
        expect(init?.method).toBe('POST');
        expect(init?.body).toBe(JSON.stringify({ targetType: 'object', targetRef: 'shape-1', parentCommentId: undefined, content: 'Pin this' }));
      } else if (idx === 2) {
        expect(init?.method).toBe('POST');
      }
      return responses[idx++] as any;
    }) as any;

    const api = createCommentsApi({ baseUrl: 'http://localhost:8080/api', accessToken: 'token-123' });
    const listed = await api.list('b-1', { publicationToken: 'pub-token' });
    const created = await api.create('b-1', { targetType: 'object', targetRef: 'shape-1', content: 'Pin this' });
    const resolved = await api.resolve('b-1', 'c-2');

    expect(listed[0].targetRef).toBeNull();
    expect(created.targetRef).toBe('shape-1');
    expect(resolved.state).toBe('resolved');
  });

  test('publications API wraps create/list/rotate/resolve flow', async () => {
    const queue = [
      new TestResponse(
        JSON.stringify({
          publication: {
            id: 'p-1', boardId: 'b-1', snapshotVersion: 3, targetType: 'snapshot', state: 'active', createdByUserId: 'alice',
            allowComments: true, createdAt: '2026-03-01T10:00:00Z', updatedAt: '2026-03-01T10:00:00Z', expiresAt: null, revokedAt: null,
          },
          token: 'pub-token',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ),
      new TestResponse(
        JSON.stringify([
          {
            id: 'p-1', boardId: 'b-1', snapshotVersion: 3, targetType: 'snapshot', state: 'active', createdByUserId: 'alice',
            allowComments: true, createdAt: '2026-03-01T10:00:00Z', updatedAt: '2026-03-01T10:00:00Z', expiresAt: null, revokedAt: null,
          },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ),
      new TestResponse(
        JSON.stringify({
          publication: {
            id: 'p-1', boardId: 'b-1', snapshotVersion: 3, targetType: 'snapshot', state: 'active', createdByUserId: 'alice',
            allowComments: true, createdAt: '2026-03-01T10:00:00Z', updatedAt: '2026-03-01T10:05:00Z', expiresAt: null, revokedAt: null,
          },
          token: 'rotated-token',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ),
      new TestResponse(
        JSON.stringify({
          id: 'p-1', boardId: 'b-1', snapshotVersion: 3, targetType: 'snapshot', state: 'active', createdByUserId: 'alice',
          allowComments: true, createdAt: '2026-03-01T10:00:00Z', updatedAt: '2026-03-01T10:05:00Z', expiresAt: null, revokedAt: null,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ),
    ];
    let idx = 0;
    globalThis.fetch = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (idx === 0) expect(init?.body).toBe(JSON.stringify({ targetType: 'snapshot', snapshotVersion: 3, allowComments: true, expiresAt: undefined }));
      return queue[idx++] as any;
    }) as any;

    const api = createPublicationsApi({ baseUrl: 'http://localhost:8080/api', accessToken: 'token-123' });
    const created = await api.create('b-1', { targetType: 'snapshot', snapshotVersion: 3, allowComments: true });
    const listed = await api.list('b-1');
    const rotated = await api.rotateToken('b-1', 'p-1');
    const resolved = await api.resolve('rotated-token');

    expect(created.token).toBe('pub-token');
    expect(listed[0].snapshotVersion).toBe(3);
    expect(rotated.token).toBe('rotated-token');
    expect(resolved.allowComments).toBe(true);
  });

  test('voting API wraps session lifecycle and results endpoints', async () => {
    const queue = [
      new TestResponse(
        JSON.stringify({
          id: 'vs-1', boardId: 'b-1', scopeType: 'object', scopeRef: 'shape-1', state: 'draft', createdByUserId: 'alice',
          rules: { allowViewerParticipation: true, allowPublishedReaderParticipation: false, maxVotesPerParticipant: 3, anonymousVotes: true, showProgressDuringVoting: false, allowVoteUpdates: true, durationSeconds: 60 },
          createdAt: '2026-03-01T10:00:00Z', updatedAt: '2026-03-01T10:00:00Z', openedAt: null, closedAt: null, revealedAt: null,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ),
      new TestResponse(
        JSON.stringify({
          id: 'vote-1', sessionId: 'vs-1', participantId: 'alice', targetRef: 'shape-1', voteValue: 1,
          createdAt: '2026-03-01T10:01:00Z', updatedAt: '2026-03-01T10:01:00Z'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ),
      new TestResponse(
        JSON.stringify({
          session: {
            id: 'vs-1', boardId: 'b-1', scopeType: 'object', scopeRef: 'shape-1', state: 'open', createdByUserId: 'alice',
            rules: { allowViewerParticipation: true, allowPublishedReaderParticipation: false, maxVotesPerParticipant: 3, anonymousVotes: true, showProgressDuringVoting: false, allowVoteUpdates: true, durationSeconds: 60 },
            createdAt: '2026-03-01T10:00:00Z', updatedAt: '2026-03-01T10:02:00Z', openedAt: '2026-03-01T10:02:00Z', closedAt: null, revealedAt: null,
          },
          totalsByTarget: { 'shape-1': 1 },
          visibleVotes: [
            { id: 'vote-1', sessionId: 'vs-1', participantId: 'alice', targetRef: 'shape-1', voteValue: 1, createdAt: '2026-03-01T10:01:00Z', updatedAt: '2026-03-01T10:01:00Z' }
          ],
          identitiesHidden: true,
          progressHidden: false,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ),
    ];
    let idx = 0;
    globalThis.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (idx === 0) {
        expect(init?.body).toBe(JSON.stringify({ scopeType: 'object', scopeRef: 'shape-1', allowViewerParticipation: true, allowPublishedReaderParticipation: false, maxVotesPerParticipant: 3, anonymousVotes: true, showProgressDuringVoting: false, allowVoteUpdates: true, durationSeconds: 60 }));
      }
      if (idx === 1) {
        expect(String(url)).toContain('/votes?publicationToken=pub-token&participantToken=part-1');
      }
      return queue[idx++] as any;
    }) as any;

    const api = createVotingApi({ baseUrl: 'http://localhost:8080/api', accessToken: 'token-123' });
    const session = await api.createSession('b-1', {
      scopeType: 'object', scopeRef: 'shape-1', allowViewerParticipation: true, allowPublishedReaderParticipation: false,
      maxVotesPerParticipant: 3, anonymousVotes: true, showProgressDuringVoting: false, allowVoteUpdates: true, durationSeconds: 60,
    });
    const vote = await api.castVote('b-1', 'vs-1', { targetRef: 'shape-1', voteValue: 1 }, { publicationToken: 'pub-token', participantToken: 'part-1' });
    const results = await api.getResults('b-1', 'vs-1');

    expect(session.rules.durationSeconds).toBe(60);
    expect(vote.voteValue).toBe(1);
    expect(results.identitiesHidden).toBe(true);
    expect(results.totalsByTarget['shape-1']).toBe(1);
  });

  test('invite administration wrappers list and revoke invites', async () => {
    let idx = 0;
    globalThis.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      idx += 1;
      if (idx === 1) {
        expect(init?.method).toBe('POST');
        return new TestResponse(JSON.stringify({
          id: 'inv-1', boardId: 'b-1', permission: 'viewer', expiresAt: null, maxUses: 5, uses: 0, revokedAt: null, createdAt: '2026-03-01T10:00:00Z', token: 'secret'
        }), { status: 200, headers: { 'content-type': 'application/json' } }) as any;
      }
      if (idx === 2) {
        expect(String(url)).toBe('http://localhost:8080/api/boards/b-1/invites');
        return new TestResponse(JSON.stringify([
          { id: 'inv-1', boardId: 'b-1', permission: 'viewer', expiresAt: null, maxUses: 5, uses: 1, revokedAt: null, createdAt: '2026-03-01T10:00:00Z' }
        ]), { status: 200, headers: { 'content-type': 'application/json' } }) as any;
      }
      expect(String(url)).toBe('http://localhost:8080/api/boards/b-1/invites/inv-1');
      expect(init?.method).toBe('DELETE');
      return new TestResponse(null, { status: 204 }) as any;
    }) as any;

    const created = await createBoardInvite({ boardId: 'b-1', permission: 'viewer', maxUses: 5 });
    const listed = await listBoardInvites('b-1');
    await revokeBoardInvite('b-1', 'inv-1');

    expect(created.token).toBe('secret');
    expect(listed[0].uses).toBe(1);
  });

  test('timer helpers build control payloads and map timer state payloads', () => {
    const control = createTimerControlPayload({
      action: 'start',
      durationMs: 30_000,
      label: 'Retro',
      scope: { type: 'section', ref: 'section-1' },
    });

    expect(control).toEqual({
      action: 'start',
      durationMs: 30_000,
      label: 'Retro',
      scope: { type: 'section', ref: 'section-1' },
    });

    const raw: any = {
      timerId: 'timer-1',
      state: 'running',
      durationMs: 30000,
      remainingMs: 29500,
      startedAt: '2026-03-01T10:00:00Z',
      endsAt: '2026-03-01T10:00:30Z',
      updatedAt: '2026-03-01T10:00:01Z',
      createdAt: '2026-03-01T10:00:00Z',
      controllerUserId: 'alice',
      label: 'Retro',
      scope: { type: 'section', ref: 'section-1' },
    };

    expect(isTimerStatePayload(raw)).toBe(true);
    expect(mapTimerStatePayload(raw)).toMatchObject({
      timerId: 'timer-1',
      remainingMs: 29500,
      scope: { type: 'section', ref: 'section-1' },
    });
  });
});
