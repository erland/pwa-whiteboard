import { CollabClient } from '../CollabClient';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: ((evt: Event) => void) | null = null;
  onmessage: ((evt: MessageEvent) => void) | null = null;
  onerror: ((evt: Event) => void) | null = null;
  onclose: ((evt: CloseEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  emitJson(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent);
  }

  close(code = 1000, reason = '') {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code, reason } as CloseEvent);
  }

  send(data: string) {
    this.sent.push(data);
  }
}

describe('java whiteboard server WebSocket contract integration', () => {
  const OriginalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    FakeWebSocket.instances = [];
    (globalThis as any).WebSocket = FakeWebSocket;
  });

  afterEach(() => {
    (globalThis as any).WebSocket = OriginalWebSocket;
    jest.restoreAllMocks();
  });

  test('normalizes java server joined payload fields like yourUserId and uppercase permission', () => {
    const joined = jest.fn();

    const client = new CollabClient(
      {
        baseUrl: 'http://localhost:8080',
        boardId: 'b-1',
        accessToken: 'token-123',
      },
      { onJoined: joined }
    );

    client.connect();
    const ws = FakeWebSocket.instances[0];
    expect(ws.url).toBe('ws://localhost:8080/ws/boards/b-1?access_token=token-123');

    ws.open();
    ws.emitJson({
      type: 'joined',
      boardId: 'b-1',
      yourUserId: 'user-7',
      permission: 'EDITOR',
      users: [{ userId: 'user-7', joinedAt: '2026-03-01T10:00:00Z' }],
      latestSnapshotVersion: 4,
      latestSnapshot: { objects: [] },
    });

    expect(joined).toHaveBeenCalledTimes(1);
    expect(joined).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'joined',
        boardId: 'b-1',
        userId: 'user-7',
        role: 'editor',
        users: [{ userId: 'user-7', displayName: 'user-7', role: 'viewer' }],
        latestSnapshot: { objects: [] },
      })
    );
  });

  test('normalizes op.from and presence.presentUserIds from java server messages', () => {
    const onOp = jest.fn();
    const onPresence = jest.fn();

    const client = new CollabClient(
      {
        baseUrl: 'http://localhost:8080',
        boardId: 'b-2',
        inviteToken: 'invite-xyz',
      },
      { onOp, onPresence }
    );

    client.connect();
    const ws = FakeWebSocket.instances[0];
    expect(ws.url).toBe('ws://localhost:8080/ws/boards/b-2?invite=invite-xyz');

    ws.open();
    ws.emitJson({
      type: 'op',
      boardId: 'b-2',
      seq: 9,
      from: 'user-9',
      op: {
        id: 'evt-1',
        boardId: 'b-2',
        type: 'objectDeleted',
        timestamp: '2026-03-01T10:00:00Z',
        payload: { objectId: 'obj-1' },
      },
    });
    ws.emitJson({
      type: 'presence',
      boardId: 'b-2',
      presentUserIds: ['user-9', 'user-10'],
    });

    expect(onOp).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'op',
        seq: 9,
        authorId: 'user-9',
      })
    );
    expect(onPresence).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'presence',
        presentUserIds: ['user-9', 'user-10'],
      })
    );
  });

  test('passes through non-fatal java server error payloads without closing the connection', () => {
    const onStatus = jest.fn();
    const onErrorMsg = jest.fn();

    const client = new CollabClient(
      {
        baseUrl: 'http://localhost:8080',
        boardId: 'b-3',
        accessToken: 'token-789',
      },
      { onStatus, onErrorMsg }
    );

    client.connect();
    const ws = FakeWebSocket.instances[0];
    ws.open();
    ws.emitJson({
      type: 'error',
      code: 'rate_limited',
      message: 'Slow down',
      fatal: false,
    });

    expect(onErrorMsg).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', code: 'rate_limited', message: 'Slow down', fatal: false })
    );
    expect(onStatus).toHaveBeenCalledWith('connecting', undefined);
    expect(ws.readyState).toBe(FakeWebSocket.OPEN);
  });
});
