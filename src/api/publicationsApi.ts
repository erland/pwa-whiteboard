import { getAccessToken } from '../auth/oidc';
import { getApiBaseUrl } from '../config/server';
import { createHttpClient } from './httpClient';
import type {
  CreatePublicationRequest,
  ResolvePublicationRequest,
  ServerPublicationCreatedResponse,
  ServerPublicationResponse,
} from './javaWhiteboardServerContract';

export type BoardPublicationTargetType = 'board' | 'snapshot';
export type BoardPublicationState = 'active' | 'revoked' | 'expired' | string;

export type BoardPublication = {
  id: string;
  boardId: string;
  snapshotVersion: number | null;
  targetType: BoardPublicationTargetType;
  state: BoardPublicationState;
  createdByUserId: string;
  allowComments: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
};

export type BoardPublicationWithToken = {
  publication: BoardPublication;
  token: string;
};

export type CreateBoardPublicationInput = {
  targetType?: BoardPublicationTargetType;
  snapshotVersion?: number;
  allowComments?: boolean;
  expiresAt?: string;
};

function mapPublication(value: ServerPublicationResponse): BoardPublication {
  return {
    id: String(value.id),
    boardId: String(value.boardId),
    snapshotVersion: value.snapshotVersion ?? null,
    targetType: (value.targetType ?? 'board') as BoardPublicationTargetType,
    state: (value.state ?? 'active') as BoardPublicationState,
    createdByUserId: String(value.createdByUserId),
    allowComments: Boolean(value.allowComments),
    createdAt: String(value.createdAt),
    updatedAt: String(value.updatedAt),
    expiresAt: value.expiresAt ?? null,
    revokedAt: value.revokedAt ?? null,
  };
}

function mapPublicationWithToken(value: ServerPublicationCreatedResponse): BoardPublicationWithToken {
  return {
    publication: mapPublication(value.publication),
    token: String(value.token),
  };
}

export function createPublicationsApi(args: { baseUrl: string; accessToken?: string | null } | undefined = undefined) {
  const client = createHttpClient({
    baseUrl: args?.baseUrl ?? getApiBaseUrl()!,
    getAccessToken: () => args?.accessToken ?? getAccessToken(),
  });

  return {
    async create(boardId: string, input: CreateBoardPublicationInput): Promise<BoardPublicationWithToken> {
      const req: CreatePublicationRequest = {
        targetType: input.targetType,
        snapshotVersion: input.snapshotVersion,
        allowComments: input.allowComments,
        expiresAt: input.expiresAt,
      };
      const res = await client.post<ServerPublicationCreatedResponse>(
        `/boards/${encodeURIComponent(boardId)}/publications`,
        { json: req }
      );
      return mapPublicationWithToken(res);
    },

    async list(boardId: string): Promise<BoardPublication[]> {
      const res = await client.get<ServerPublicationResponse[]>(`/boards/${encodeURIComponent(boardId)}/publications`);
      return Array.isArray(res) ? res.map(mapPublication) : [];
    },

    async revoke(boardId: string, publicationId: string): Promise<void> {
      await client.del<void>(`/boards/${encodeURIComponent(boardId)}/publications/${encodeURIComponent(publicationId)}`);
    },

    async rotateToken(boardId: string, publicationId: string): Promise<BoardPublicationWithToken> {
      const res = await client.post<ServerPublicationCreatedResponse>(
        `/boards/${encodeURIComponent(boardId)}/publications/${encodeURIComponent(publicationId)}/rotate-token`
      );
      return mapPublicationWithToken(res);
    },

    async resolve(token: string): Promise<BoardPublication> {
      const req: ResolvePublicationRequest = { token };
      const res = await client.post<ServerPublicationResponse>('/publications/resolve', { json: req });
      return mapPublication(res);
    },
  };
}
