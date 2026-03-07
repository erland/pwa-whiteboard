import { encodeSnapshotJson } from '../../../../domain/snapshotCodec';
import { createEmptyWhiteboardState } from '../../../../domain/whiteboardState';
import { decodeJoinedSnapshotOrNull } from '../useSnapshotOrchestration';

describe('useSnapshotOrchestration', () => {
  it('decodes joined latestSnapshot payloads', () => {
    const base = createEmptyWhiteboardState({
      id: 'board-1',
      name: 'Board 1',
      boardType: 'advanced',
      createdAt: '2026-03-07T00:00:00.000Z',
      updatedAt: '2026-03-07T00:00:00.000Z',
    });
    const payload = JSON.parse(encodeSnapshotJson('board-1', base));

    const state = decodeJoinedSnapshotOrNull('board-1', {
      latestSnapshot: payload,
    });

    expect(state?.meta.id).toBe('board-1');
    expect(state?.meta.name).toBe('Board 1');
  });

  it('returns null for invalid joined snapshot payloads', () => {
    expect(decodeJoinedSnapshotOrNull('board-1', { latestSnapshot: { nope: true } })).toBeNull();
  });
});
