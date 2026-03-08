import { getAccessToken } from '../auth/oidc';
import { getApiBaseUrl } from '../config/server';
import { createHttpClient } from './httpClient';
import type {
  CreateCommentRequest,
  ServerCommentResponse,
  ServerCommentState,
  ServerCommentTargetType,
  UpdateCommentRequest,
} from './javaWhiteboardServerContract';

export type BoardCommentTargetType = ServerCommentTargetType;
export type BoardCommentState = Extract<ServerCommentState, 'active' | 'resolved' | 'deleted'> | string;

export type BoardComment = {
  id: string;
  boardId: string;
  parentCommentId: string | null;
  targetType: BoardCommentTargetType;
  targetRef: string | null;
  authorUserId: string;
  content: string;
  state: BoardCommentState;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  deletedAt: string | null;
};

export type CreateBoardCommentInput = {
  targetType: BoardCommentTargetType;
  targetRef?: string | null;
  parentCommentId?: string | null;
  content: string;
};

function mapComment(value: ServerCommentResponse): BoardComment {
  return {
    id: String(value.id),
    boardId: String(value.boardId),
    parentCommentId: value.parentCommentId ?? null,
    targetType: value.targetType,
    targetRef: value.targetRef ?? null,
    authorUserId: String(value.authorUserId),
    content: String(value.content ?? ''),
    state: (value.state ?? 'active') as BoardCommentState,
    createdAt: String(value.createdAt),
    updatedAt: String(value.updatedAt),
    resolvedAt: value.resolvedAt ?? null,
    deletedAt: value.deletedAt ?? null,
  };
}

function withOptionalQuery(path: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== '') params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function createCommentsApi(args: { baseUrl: string; accessToken?: string | null } | undefined = undefined) {
  const client = createHttpClient({
    baseUrl: args?.baseUrl ?? getApiBaseUrl()!,
    getAccessToken: () => args?.accessToken ?? getAccessToken(),
  });

  return {
    async list(boardId: string, options?: { publicationToken?: string }): Promise<BoardComment[]> {
      const path = withOptionalQuery(`/boards/${encodeURIComponent(boardId)}/comments`, {
        publicationToken: options?.publicationToken,
      });
      const res = await client.get<ServerCommentResponse[]>(path);
      return Array.isArray(res) ? res.map(mapComment) : [];
    },

    async create(boardId: string, input: CreateBoardCommentInput): Promise<BoardComment> {
      const req: CreateCommentRequest = {
        targetType: input.targetType,
        targetRef: input.targetRef ?? undefined,
        parentCommentId: input.parentCommentId ?? undefined,
        content: input.content,
      };
      const res = await client.post<ServerCommentResponse>(`/boards/${encodeURIComponent(boardId)}/comments`, { json: req });
      return mapComment(res);
    },

    async update(boardId: string, commentId: string, content: string): Promise<BoardComment> {
      const req: UpdateCommentRequest = { content };
      const res = await client.patch<ServerCommentResponse>(
        `/boards/${encodeURIComponent(boardId)}/comments/${encodeURIComponent(commentId)}`,
        { json: req }
      );
      return mapComment(res);
    },

    async resolve(boardId: string, commentId: string): Promise<BoardComment> {
      const res = await client.post<ServerCommentResponse>(
        `/boards/${encodeURIComponent(boardId)}/comments/${encodeURIComponent(commentId)}/resolve`
      );
      return mapComment(res);
    },

    async reopen(boardId: string, commentId: string): Promise<BoardComment> {
      const res = await client.post<ServerCommentResponse>(
        `/boards/${encodeURIComponent(boardId)}/comments/${encodeURIComponent(commentId)}/reopen`
      );
      return mapComment(res);
    },

    async remove(boardId: string, commentId: string): Promise<BoardComment> {
      const res = await client.del<ServerCommentResponse>(
        `/boards/${encodeURIComponent(boardId)}/comments/${encodeURIComponent(commentId)}`
      );
      return mapComment(res);
    },
  };
}
