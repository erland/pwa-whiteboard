import { createHttpClient } from './httpClient';

export type SnapshotResponse = {
  id: string;
  boardId: string;
  version: number;
  // Server returns the snapshot payload as a JSON object under `snapshot`.
  snapshot: unknown;
  createdAt: string;
};

export type SnapshotVersionsResponse = {
  versions: number[];
};

export function createSnapshotsApi(args: { baseUrl: string; accessToken: string }) {
  const client = createHttpClient({ baseUrl: args.baseUrl, getAccessToken: () => args.accessToken });

  return {
    async listVersions(boardId: string): Promise<number[]> {
      const res = await client.get<SnapshotVersionsResponse>(`/boards/${encodeURIComponent(boardId)}/snapshots`);
      return Array.isArray(res.versions) ? res.versions : [];
    },

    async get(boardId: string, version: number): Promise<SnapshotResponse> {
      return client.get<SnapshotResponse>(
        `/boards/${encodeURIComponent(boardId)}/snapshots/${encodeURIComponent(String(version))}`
      );
    },

    async getLatest(boardId: string): Promise<SnapshotResponse | null> {
      const versions = await this.listVersions(boardId);
      if (!versions.length) return null;
      const latest = Math.max(...versions);
      return this.get(boardId, latest);
    },

    async create(boardId: string, snapshotJson: string): Promise<SnapshotResponse> {
      // Server expects { snapshot: <json> } (see CreateSnapshotRequest.snapshot()).
      // Client uses a JSON string, so parse it before sending.
      let snapshot: unknown;
      try {
        snapshot = JSON.parse(snapshotJson);
      } catch (e) {
        throw new Error(`Invalid snapshot JSON: ${(e as Error)?.message ?? String(e)}`);
      }

      return client.post<SnapshotResponse>(`/boards/${encodeURIComponent(boardId)}/snapshots`, { json: { snapshot } });
    },
  };
}
