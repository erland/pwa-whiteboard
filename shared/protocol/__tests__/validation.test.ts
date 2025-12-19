import {
  parseAndValidateClientMessage,
  parseAndValidateServerMessage,
  validateClientToServerMessage,
  validateServerToClientMessage,
} from '../validation';

describe('protocol validation', () => {
  test('validates client join (owner)', () => {
    const msg = {
      type: 'join',
      boardId: 'board-1',
      auth: { kind: 'owner', supabaseJwt: 'jwt' },
      clientKnownSeq: 0,
      client: { guestId: 'g1', displayName: 'Guest', color: '#fff' },
    };
    const res = validateClientToServerMessage(msg);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.type).toBe('join');
      expect(res.value.boardId).toBe('board-1');
    }
  });

  test('rejects join without boardId', () => {
    const res = validateClientToServerMessage({ type: 'join', auth: { kind: 'invite', inviteToken: 't' } });
    expect(res.ok).toBe(false);
  });

  test('validates client op', () => {
    const res = validateClientToServerMessage({
      type: 'op',
      boardId: 'b',
      clientOpId: 'c1',
      baseSeq: 5,
      op: {
        id: 'e1',
        boardId: 'b',
        type: 'viewportChanged',
        timestamp: '2025-01-01T00:00:00.000Z',
        payload: { viewport: { x: 0 } },
      },
    });
    expect(res.ok).toBe(true);
  });

  test('rejects client op with negative baseSeq', () => {
    const res = validateClientToServerMessage({
      type: 'op',
      boardId: 'b',
      clientOpId: 'c1',
      baseSeq: -1,
      op: {},
    });
    expect(res.ok).toBe(false);
  });

  test('validates client presence', () => {
    const res = validateClientToServerMessage({
      type: 'presence',
      boardId: 'b',
      presence: { cursor: { x: 1, y: 2 }, selectionIds: ['o1', 'o2'] },
    });
    expect(res.ok).toBe(true);
  });

  
  test('valid op message with BoardEvent envelope passes', () => {
    const msg = {
      type: 'op',
      boardId: 'board-1',
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
      expect(res.value.boardId).toBe('board-1');
      expect(res.value.op.boardId).toBe('board-1');
    }
  });

test('validates server joined', () => {
    const res = validateServerToClientMessage({
      type: 'joined',
      boardId: 'b',
      role: 'editor',
      seq: 12,
      users: [{ userId: 'u1', displayName: 'Alice', role: 'editor', color: 'red' }],
    });
    expect(res.ok).toBe(true);
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
