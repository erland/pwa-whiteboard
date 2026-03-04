import { createHttpClient } from './httpClient';

export type SnapshotResponse = {
  id: string;
  boardId: string;
  version: number;
  snapshotJson: string;
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
      return client.post<SnapshotResponse>(`/boards/${encodeURIComponent(boardId)}/snapshots`, { json: { snapshotJson } });
    },
  };
}
