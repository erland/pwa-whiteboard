import { parseAndValidateServerMessage } from '../../collab/protocol/validation';
import type {
  CreateBoardRequest,
  CreateSnapshotRequest,
  ServerInviteValidationResponse,
  WsJoinedMessage,
  WsOpMessage,
} from '../javaWhiteboardServerContract';

function asJson<T>(value: T): string {
  return JSON.stringify(value);
}

describe('javaWhiteboardServerContract freeze', () => {
  it('captures the board create request shape used by the current server', () => {
    const req: CreateBoardRequest = {
      name: 'Board',
      type: 'whiteboard',
      boardType: 'advanced',
    };

    expect(req).toEqual({ name: 'Board', type: 'whiteboard', boardType: 'advanced' });
  });

  it('captures snapshot create as an opaque JSON payload under snapshot', () => {
    const req: CreateSnapshotRequest = {
      snapshot: {
        meta: { id: 'b1' },
        objects: [],
      },
    };

    expect(req.snapshot).toEqual({ meta: { id: 'b1' }, objects: [] });
  });

  it('documents invite validation reason as part of the actual server response', () => {
    const res: ServerInviteValidationResponse = {
      valid: false,
      reason: 'EXPIRED',
      boardId: 'b1',
      permission: 'viewer',
      expiresAt: '2026-04-01T00:00:00Z',
    };

    expect(res.reason).toBe('EXPIRED');
  });

  it('accepts the actual joined payload currently emitted by java-whiteboard-server', () => {
    const msg: WsJoinedMessage = {
      type: 'joined',
      boardId: 'b1',
      yourUserId: 'alice',
      latestSnapshotVersion: 3,
      latestSnapshot: { objects: [] },
      users: [{ userId: 'alice', joinedAt: '2026-03-01T10:30:00Z' }],
      wsSessionId: 'ws-1',
      correlationId: 'corr-1',
    };

    const parsed = parseAndValidateServerMessage(asJson(msg));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.type).toBe('joined');
    if (parsed.value.type !== 'joined') return;
    expect(parsed.value.userId).toBe('alice');
    expect(parsed.value.boardId).toBe('b1');
  });

  it('accepts the actual op payload currently emitted by java-whiteboard-server', () => {
    const msg: WsOpMessage = {
      type: 'op',
      boardId: 'b1',
      seq: 4,
      from: 'alice',
      op: {
        id: 'evt-1',
        boardId: 'b1',
        type: 'selectionChanged',
        timestamp: '2026-03-01T10:31:00Z',
        payload: { selectedIds: [] },
      },
    };

    const parsed = parseAndValidateServerMessage(asJson(msg));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.type).toBe('op');
    if (parsed.value.type !== 'op') return;
    expect(parsed.value.authorId).toBe('alice');
    expect(parsed.value.seq).toBe(4);
  });
});
