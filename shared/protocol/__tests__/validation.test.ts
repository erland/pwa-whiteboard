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
      op: { any: 'payload' },
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
