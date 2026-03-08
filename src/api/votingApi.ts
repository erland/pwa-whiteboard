import { getAccessToken } from '../auth/oidc';
import { getApiBaseUrl } from '../config/server';
import { createHttpClient } from './httpClient';
import type {
  CreateVoteRequest,
  CreateVotingSessionRequest,
  ServerVoteRecordResponse,
  ServerVotingResultsResponse,
  ServerVotingSessionResponse,
} from './javaWhiteboardServerContract';

export type VotingScopeType = 'board' | 'object' | 'section' | string;
export type VotingSessionState = 'draft' | 'open' | 'closed' | 'revealed' | 'cancelled' | string;

export type VotingRules = {
  allowViewerParticipation: boolean;
  allowPublishedReaderParticipation: boolean;
  maxVotesPerParticipant: number;
  anonymousVotes: boolean;
  showProgressDuringVoting: boolean;
  allowVoteUpdates: boolean;
  durationSeconds: number | null;
};

export type VotingSession = {
  id: string;
  boardId: string;
  scopeType: VotingScopeType;
  scopeRef: string | null;
  state: VotingSessionState;
  createdByUserId: string;
  rules: VotingRules;
  createdAt: string | null;
  updatedAt: string | null;
  openedAt: string | null;
  closedAt: string | null;
  revealedAt: string | null;
};

export type VoteRecord = {
  id: string;
  sessionId: string;
  participantId: string | null;
  targetRef: string;
  voteValue: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type VotingResults = {
  session: VotingSession;
  totalsByTarget: Record<string, number>;
  visibleVotes: VoteRecord[];
  identitiesHidden: boolean;
  progressHidden: boolean;
};

export type CreateVotingSessionInput = {
  scopeType?: VotingScopeType;
  scopeRef?: string;
  allowViewerParticipation?: boolean;
  allowPublishedReaderParticipation?: boolean;
  maxVotesPerParticipant?: number;
  anonymousVotes?: boolean;
  showProgressDuringVoting?: boolean;
  allowVoteUpdates?: boolean;
  durationSeconds?: number;
};

function withOptionalQuery(path: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== '') params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function mapVotingSession(value: ServerVotingSessionResponse): VotingSession {
  return {
    id: String(value.id),
    boardId: String(value.boardId),
    scopeType: value.scopeType ?? 'board',
    scopeRef: value.scopeRef ?? null,
    state: value.state ?? 'draft',
    createdByUserId: String(value.createdByUserId),
    rules: {
      allowViewerParticipation: Boolean(value.rules?.allowViewerParticipation),
      allowPublishedReaderParticipation: Boolean(value.rules?.allowPublishedReaderParticipation),
      maxVotesPerParticipant: Number(value.rules?.maxVotesPerParticipant ?? 1),
      anonymousVotes: Boolean(value.rules?.anonymousVotes),
      showProgressDuringVoting: Boolean(value.rules?.showProgressDuringVoting),
      allowVoteUpdates: Boolean(value.rules?.allowVoteUpdates),
      durationSeconds: value.rules?.durationSeconds ?? null,
    },
    createdAt: value.createdAt ?? null,
    updatedAt: value.updatedAt ?? null,
    openedAt: value.openedAt ?? null,
    closedAt: value.closedAt ?? null,
    revealedAt: value.revealedAt ?? null,
  };
}

function mapVoteRecord(value: ServerVoteRecordResponse): VoteRecord {
  return {
    id: String(value.id),
    sessionId: String(value.sessionId),
    participantId: value.participantId ?? null,
    targetRef: String(value.targetRef),
    voteValue: Number(value.voteValue ?? 0),
    createdAt: value.createdAt ?? null,
    updatedAt: value.updatedAt ?? null,
  };
}

function mapVotingResults(value: ServerVotingResultsResponse): VotingResults {
  return {
    session: mapVotingSession(value.session),
    totalsByTarget: Object.fromEntries(
      Object.entries(value.totalsByTarget ?? {}).map(([k, v]) => [k, Number(v ?? 0)])
    ),
    visibleVotes: Array.isArray(value.visibleVotes) ? value.visibleVotes.map(mapVoteRecord) : [],
    identitiesHidden: Boolean(value.identitiesHidden),
    progressHidden: Boolean(value.progressHidden),
  };
}

export function createVotingApi(args: { baseUrl: string; accessToken?: string | null } | undefined = undefined) {
  const client = createHttpClient({
    baseUrl: args?.baseUrl ?? getApiBaseUrl()!,
    getAccessToken: () => args?.accessToken ?? getAccessToken(),
  });

  return {
    async createSession(boardId: string, input: CreateVotingSessionInput): Promise<VotingSession> {
      const req: CreateVotingSessionRequest = {
        scopeType: input.scopeType,
        scopeRef: input.scopeRef,
        allowViewerParticipation: input.allowViewerParticipation,
        allowPublishedReaderParticipation: input.allowPublishedReaderParticipation,
        maxVotesPerParticipant: input.maxVotesPerParticipant,
        anonymousVotes: input.anonymousVotes,
        showProgressDuringVoting: input.showProgressDuringVoting,
        allowVoteUpdates: input.allowVoteUpdates,
        durationSeconds: input.durationSeconds,
      };
      const res = await client.post<ServerVotingSessionResponse>(`/boards/${encodeURIComponent(boardId)}/voting-sessions`, {
        json: req,
      });
      return mapVotingSession(res);
    },

    async listSessions(boardId: string, options?: { publicationToken?: string }): Promise<VotingSession[]> {
      const path = withOptionalQuery(`/boards/${encodeURIComponent(boardId)}/voting-sessions`, {
        publicationToken: options?.publicationToken,
      });
      const res = await client.get<ServerVotingSessionResponse[]>(path);
      return Array.isArray(res) ? res.map(mapVotingSession) : [];
    },

    async getSession(boardId: string, sessionId: string, options?: { publicationToken?: string }): Promise<VotingSession> {
      const path = withOptionalQuery(
        `/boards/${encodeURIComponent(boardId)}/voting-sessions/${encodeURIComponent(sessionId)}`,
        { publicationToken: options?.publicationToken }
      );
      const res = await client.get<ServerVotingSessionResponse>(path);
      return mapVotingSession(res);
    },

    async openSession(boardId: string, sessionId: string): Promise<VotingSession> {
      const res = await client.post<ServerVotingSessionResponse>(
        `/boards/${encodeURIComponent(boardId)}/voting-sessions/${encodeURIComponent(sessionId)}/open`
      );
      return mapVotingSession(res);
    },

    async closeSession(boardId: string, sessionId: string): Promise<VotingSession> {
      const res = await client.post<ServerVotingSessionResponse>(
        `/boards/${encodeURIComponent(boardId)}/voting-sessions/${encodeURIComponent(sessionId)}/close`
      );
      return mapVotingSession(res);
    },

    async revealSession(boardId: string, sessionId: string): Promise<VotingSession> {
      const res = await client.post<ServerVotingSessionResponse>(
        `/boards/${encodeURIComponent(boardId)}/voting-sessions/${encodeURIComponent(sessionId)}/reveal`
      );
      return mapVotingSession(res);
    },

    async cancelSession(boardId: string, sessionId: string): Promise<VotingSession> {
      const res = await client.post<ServerVotingSessionResponse>(
        `/boards/${encodeURIComponent(boardId)}/voting-sessions/${encodeURIComponent(sessionId)}/cancel`
      );
      return mapVotingSession(res);
    },

    async castVote(
      boardId: string,
      sessionId: string,
      input: { targetRef: string; voteValue?: number },
      options?: { publicationToken?: string; participantToken?: string }
    ): Promise<VoteRecord> {
      const req: CreateVoteRequest = { targetRef: input.targetRef, voteValue: input.voteValue };
      const path = withOptionalQuery(
        `/boards/${encodeURIComponent(boardId)}/voting-sessions/${encodeURIComponent(sessionId)}/votes`,
        {
          publicationToken: options?.publicationToken,
          participantToken: options?.participantToken,
        }
      );
      const res = await client.post<ServerVoteRecordResponse>(path, { json: req });
      return mapVoteRecord(res);
    },

    async removeVote(
      boardId: string,
      sessionId: string,
      targetRef: string,
      options?: { publicationToken?: string; participantToken?: string }
    ): Promise<void> {
      const path = withOptionalQuery(
        `/boards/${encodeURIComponent(boardId)}/voting-sessions/${encodeURIComponent(sessionId)}/votes`,
        {
          targetRef,
          publicationToken: options?.publicationToken,
          participantToken: options?.participantToken,
        }
      );
      await client.del<void>(path);
    },

    async getResults(boardId: string, sessionId: string, options?: { publicationToken?: string }): Promise<VotingResults> {
      const path = withOptionalQuery(
        `/boards/${encodeURIComponent(boardId)}/voting-sessions/${encodeURIComponent(sessionId)}/results`,
        { publicationToken: options?.publicationToken }
      );
      const res = await client.get<ServerVotingResultsResponse>(path);
      return mapVotingResults(res);
    },
  };
}
