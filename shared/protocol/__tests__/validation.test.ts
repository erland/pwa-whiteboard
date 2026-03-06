import {
  parseAndValidateClientMessage,
  parseAndValidateServerMessage,
  validateClientToServerMessage,
  validateServerToClientMessage,
} from '../validation';

describe('protocol validation', () => {
  test('validates client op', () => {
    const res = validateClientToServerMessage({
      type: 'op',
      baseSeq: 5,
      op: {
        id: 'e1',
        boardId: 'b',
        type: 'viewportChanged',
        timestamp: '2025-01-01T00:00:00.000Z',
        payload: { viewport: { offsetX: 0 } },
      },
    });
    expect(res.ok).toBe(true);
  });

  test('rejects client op with negative baseSeq', () => {
    const res = validateClientToServerMessage({
      type: 'op',
      baseSeq: -1,
      op: {},
    });
    expect(res.ok).toBe(false);
  });

  
  test('valid op message with BoardEvent envelope passes', () => {
    const msg = {
      type: 'op',
      clientOpId: 'client-op-1',
      baseSeq: 0,
      op: {
        id: 'event-1',
        boardId: 'board-1',
        type: 'objectCreated',
        timestamp: new Date().toISOString(),
        payload: {
          object: {
            id: 'obj-1',
            type: 'text',
            x: 0,
            y: 0,
            text: 'hi',
            fontSize: 16,
            textColor: '#111111',
          }
        }
      }
    };

    const res = validateClientToServerMessage(msg);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.type).toBe('op');
      expect(res.value.op.boardId).toBe('board-1');
    }
  });

  test('validates server joined', () => {
    const res = validateServerToClientMessage({
      type: 'joined',
      boardId: 'b',
      userId: 'u-me',
      role: 'EDITOR',
      presentUserIds: ['u-me', 'u2'],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.role).toBe('editor');
    }
  });


test('rejects objectCreated with too-long text', () => {
  const longText = 'a'.repeat(10001);
  const msg = {
    type: 'op',
    boardId: 'board-1',
    clientOpId: 'client-op-2',
    baseSeq: 0,
    op: {
      id: 'event-2',
      boardId: 'board-1',
      type: 'objectCreated',
      timestamp: new Date().toISOString(),
      payload: {
        object: {
          id: 'obj-2',
          type: 'text',
          x: 0,
          y: 0,
          text: longText,
          fontSize: 16,
          textColor: '#111111',
        },
      },
    },
  };

  const res = validateClientToServerMessage(msg as any);
  expect(res.ok).toBe(false);
});

test('rejects malformed op payload cleanly', () => {
  const raw = JSON.stringify({
    type: 'op',
    clientOpId: 'c1',
    baseSeq: 0,
    op: { id: 'e1', boardId: 'b', type: 'objectCreated', timestamp: 't', payload: { object: 123 } },
  });
  const res = parseAndValidateClientMessage(raw);
  expect(res.ok).toBe(false);
});


  test('validates parseAndValidateClientMessage with byte limit', () => {
    const raw = JSON.stringify({ type: 'ping', t: 123 });
    const res = parseAndValidateClientMessage(raw);
    expect(res.ok).toBe(true);
  });

  test('validates parseAndValidateServerMessage', () => {
    const raw = JSON.stringify({ type: 'pong', t: 123 });
    const res = parseAndValidateServerMessage(raw);
    expect(res.ok).toBe(true);
  });
});


  test('validates server joined from java server shape (yourUserId + users minimal)', () => {
    const res = validateServerToClientMessage({
      type: 'joined',
      boardId: 'b',
      yourUserId: 'alice',
      // permission/role intentionally omitted (server currently doesn't send it)
      users: [{ userId: 'alice', joinedAt: new Date().toISOString() }],
      latestSnapshotVersion: 1,
      latestSnapshot: { schemaVersion: 1, events: [] },
    } as any);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.userId).toBe('alice');
      // default role
      expect(res.value.role).toBe('editor');
      expect(res.value.users?.[0].userId).toBe('alice');
    }
  });

