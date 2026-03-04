import { useEffect, useRef } from 'react';
import type { WhiteboardState } from '../../../domain/types';
import type { BoardRole } from '../../../../shared/protocol';
import { createSnapshotsApi } from '../../../api/snapshotsApi';
import { decodeSnapshotJson, encodeSnapshotJson } from '../../../domain/snapshotCodec';

export type SnapshotSyncArgs = {
  enabled: boolean;
  status: 'disabled' | 'idle' | 'connecting' | 'connected' | 'closed' | 'error';
  role?: BoardRole;
  boardId?: string;
  baseUrl: string;
  accessToken?: string | null;
  state?: WhiteboardState | null;
};

export function useSnapshotAutosave({
  enabled,
  status,
  role,
  boardId,
  baseUrl,
  accessToken,
  state,
}: SnapshotSyncArgs): void {
  const lastSavedSnapshotRef = useRef<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (status !== 'connected') return;
    if (!boardId) return;
    if (!state) return;
    if (state.meta?.id !== boardId) return;
    if (!(role === 'owner' || role === 'editor')) return;

    // Debounce saves to avoid writing on every small interaction.
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    saveTimerRef.current = window.setTimeout(() => {
      (async () => {
        try {
          if (!baseUrl || !accessToken) return;
          const snapshotJson = encodeSnapshotJson(boardId, state);
          if (lastSavedSnapshotRef.current === snapshotJson) return;

          const api = createSnapshotsApi({ baseUrl, accessToken });
          await api.create(boardId, snapshotJson);
          lastSavedSnapshotRef.current = snapshotJson;
        } catch (err) {
          console.warn('Failed to save snapshot', err);
        }
      })();
    }, 1000);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [
    enabled,
    status,
    role,
    boardId,
    baseUrl,
    accessToken,
    // Snapshot content drivers (keep this cheap; we encode in the timer)
    state?.objects,
    state?.viewport?.offsetX,
    state?.viewport?.offsetY,
    state?.viewport?.zoom,
    state?.selectedObjectIds,
  ]);
}

export async function loadLatestSnapshotOrNull(args: {
  baseUrl: string;
  accessToken: string;
  boardId: string;
}): Promise<WhiteboardState | null> {
  const { baseUrl, accessToken, boardId } = args;
  const api = createSnapshotsApi({ baseUrl, accessToken });
  const latest = await api.getLatest(boardId);
  if (!latest?.snapshotJson) return null;
  return decodeSnapshotJson(boardId, latest.snapshotJson);
}
