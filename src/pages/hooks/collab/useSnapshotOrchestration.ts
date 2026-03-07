import { useCallback, useEffect, useRef } from 'react';
import type { ServerJoinedMessage } from '../../../../shared/protocol';
import type { BoardRole } from '../../../../shared/protocol';
import type { WhiteboardState } from '../../../domain/types';
import { decodeSnapshotJson } from '../../../domain/snapshotCodec';
import { loadLatestSnapshotOrNull, useSnapshotAutosave } from './useSnapshotSync';

export type SnapshotOrchestrationArgs = {
  enabled: boolean;
  status: 'disabled' | 'idle' | 'connecting' | 'connected' | 'closed' | 'error';
  role?: BoardRole;
  boardId?: string;
  baseUrl?: string;
  accessToken?: string | null;
  state?: WhiteboardState | null;
  resetBoard: (next: WhiteboardState) => void;
};

export function decodeJoinedSnapshotOrNull(
  boardId: string,
  msg: Pick<ServerJoinedMessage, 'latestSnapshot' | 'snapshot'>
): WhiteboardState | null {
  try {
    const snap = msg.latestSnapshot ?? msg.snapshot;
    if (!snap) return null;
    return decodeSnapshotJson(boardId, JSON.stringify(snap));
  } catch {
    return null;
  }
}

export function useSnapshotOrchestration({
  enabled,
  status,
  role,
  boardId,
  baseUrl,
  accessToken,
  state,
  resetBoard,
}: SnapshotOrchestrationArgs): {
  bootstrapSnapshotOnJoin: (msg: Pick<ServerJoinedMessage, 'latestSnapshot' | 'snapshot'>) => void;
} {
  const resetBoardRef = useRef(resetBoard);

  useEffect(() => {
    resetBoardRef.current = resetBoard;
  }, [resetBoard]);

  useSnapshotAutosave({
    enabled,
    status,
    role,
    boardId,
    baseUrl: baseUrl ?? '',
    accessToken,
    state,
  });

  const bootstrapSnapshotOnJoin = useCallback(
    (msg: Pick<ServerJoinedMessage, 'latestSnapshot' | 'snapshot'>) => {
      if (!boardId) return;

      (async () => {
        try {
          if (!accessToken) {
            const decoded = decodeJoinedSnapshotOrNull(boardId, msg);
            if (decoded) resetBoardRef.current(decoded);
            return;
          }

          if (!baseUrl) return;
          const decoded = await loadLatestSnapshotOrNull({ baseUrl, accessToken, boardId });
          if (decoded) resetBoardRef.current(decoded);
        } catch {
          // Best-effort: if snapshot bootstrap fails, keep whatever local state we have.
        }
      })();
    },
    [accessToken, baseUrl, boardId]
  );

  return { bootstrapSnapshotOnJoin };
}
