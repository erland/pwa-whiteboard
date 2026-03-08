import type { JsonValue } from './httpClient';

/**
 * Frozen description of the current java-whiteboard-server HTTP + WebSocket wire contract.
 */

export type ServerBoardStatus = 'active' | 'archived' | 'deleted' | string;
export type ServerInvitePermission = 'viewer' | 'editor';
export type ServerBoardAccessRole = 'owner' | 'editor' | 'viewer';
export type ServerCapability =
  | 'comments'
  | 'voting'
  | 'publications'
  | 'shared-timer'
  | 'ws-reactions'
  | 'board-assets'
  | string;

export type ServerBoard = {
  id: string;
  name: string;
  type: string;
  boardType?: string;
  ownerUserId: string;
  status: ServerBoardStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateBoardRequest = {
  name: string;
  type: string;
  boardType: string;
};

export type UpdateBoardRequest = {
  name?: string;
  type?: string;
  boardType?: string;
};

export type ServerSnapshotResponse = {
  boardId: string;
  version: number;
  snapshot: JsonValue;
  createdAt: string;
  createdBy: string;
};

export type ServerSnapshotVersionsResponse = {
  versions: number[];
};

export type CreateSnapshotRequest = {
  snapshot: JsonValue;
};

export type CreateInviteRequest = {
  permission: ServerInvitePermission;
  expiresAt?: string;
  maxUses?: number;
};

export type ServerInviteCreatedResponse = {
  id: string;
  boardId: string;
  permission: ServerInvitePermission;
  expiresAt?: string;
  maxUses?: number;
  uses: number;
  revokedAt?: string;
  createdAt: string;
  token: string;
};

export type ServerInviteResponse = {
  id: string;
  boardId: string;
  permission: ServerInvitePermission;
  expiresAt?: string;
  maxUses?: number;
  uses: number;
  revokedAt?: string;
  createdAt: string;
};

export type ValidateInviteRequest = {
  token: string;
};

export type ServerInviteValidationReason =
  | 'OK'
  | 'NOT_FOUND'
  | 'EXPIRED'
  | 'REVOKED'
  | 'MAX_USES_REACHED';

export type ServerInviteValidationResponse = {
  valid: boolean;
  reason: ServerInviteValidationReason;
  boardId?: string;
  permission?: ServerInvitePermission;
  expiresAt?: string;
};

export type AcceptInviteRequest = {
  token: string;
};

export type ServerAcceptInviteResponse = {
  boardId: string;
  role: ServerBoardAccessRole;
};

export type ServerMeResponse = {
  userId: string;
  roles: string[];
};

export type ServerApiError = {
  code: string;
  message: string;
};

export type ServerCommentTargetType = 'board' | 'object' | 'region' | 'comment';
export type ServerCommentState = 'active' | 'resolved' | 'deleted' | string;

export type CreateCommentRequest = {
  targetType: ServerCommentTargetType;
  targetRef?: string;
  parentCommentId?: string;
  content: string;
};

export type UpdateCommentRequest = {
  content: string;
};

export type ServerCommentResponse = {
  id: string;
  boardId: string;
  parentCommentId?: string | null;
  targetType: ServerCommentTargetType;
  targetRef?: string | null;
  authorUserId: string;
  content: string;
  state: ServerCommentState;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  deletedAt?: string | null;
};

export type ServerVotingScopeType = 'board' | 'object' | 'section' | string;
export type ServerVotingSessionState = 'draft' | 'open' | 'closed' | 'revealed' | 'cancelled' | string;

export type CreateVotingSessionRequest = {
  scopeType?: ServerVotingScopeType;
  scopeRef?: string;
  allowViewerParticipation?: boolean;
  allowPublishedReaderParticipation?: boolean;
  maxVotesPerParticipant?: number;
  anonymousVotes?: boolean;
  showProgressDuringVoting?: boolean;
  allowVoteUpdates?: boolean;
  durationSeconds?: number;
};

export type ServerVotingRulesResponse = {
  allowViewerParticipation: boolean;
  allowPublishedReaderParticipation: boolean;
  maxVotesPerParticipant: number;
  anonymousVotes: boolean;
  showProgressDuringVoting: boolean;
  allowVoteUpdates: boolean;
  durationSeconds?: number | null;
};

export type ServerVotingSessionResponse = {
  id: string;
  boardId: string;
  scopeType: ServerVotingScopeType;
  scopeRef?: string | null;
  state: ServerVotingSessionState;
  createdByUserId: string;
  rules: ServerVotingRulesResponse;
  createdAt?: string | null;
  updatedAt?: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
  revealedAt?: string | null;
};

export type CreateVoteRequest = {
  targetRef: string;
  voteValue?: number;
};

export type ServerVoteRecordResponse = {
  id: string;
  sessionId: string;
  participantId?: string | null;
  targetRef: string;
  voteValue: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ServerVotingResultsResponse = {
  session: ServerVotingSessionResponse;
  totalsByTarget: Record<string, number>;
  visibleVotes: ServerVoteRecordResponse[];
  identitiesHidden: boolean;
  progressHidden: boolean;
};

export type ServerPublicationTargetType = 'board' | 'snapshot';
export type ServerPublicationState = 'active' | 'revoked' | 'expired' | string;

export type CreatePublicationRequest = {
  targetType?: ServerPublicationTargetType;
  snapshotVersion?: number;
  allowComments?: boolean;
  expiresAt?: string;
};

export type ServerPublicationResponse = {
  id: string;
  boardId: string;
  snapshotVersion?: number | null;
  targetType: ServerPublicationTargetType;
  state: ServerPublicationState;
  createdByUserId: string;
  allowComments: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
};

export type ServerPublicationCreatedResponse = {
  publication: ServerPublicationResponse;
  token: string;
};

export type ResolvePublicationRequest = {
  token: string;
};

export type ServerCapabilitiesResponse = {
  apiVersion: string;
  wsProtocolVersion: string;
  capabilities: ServerCapability[];
};

export type WsPresenceUser = {
  userId: string;
  displayName?: string;
  color?: string;
  role?: ServerBoardAccessRole;
  joinedAt?: string;
};

export type WsJoinedMessage = {
  type: 'joined';
  boardId: string;
  yourUserId: string;
  latestSnapshotVersion?: number | null;
  latestSnapshot?: JsonValue | null;
  users: WsPresenceUser[];
  wsSessionId?: string | null;
  correlationId?: string | null;
  protocolVersion?: number | null;
  capabilities?: ServerCapability[] | null;
};

export type WsPresenceMessage = {
  type: 'presence';
  boardId: string;
  users: WsPresenceUser[];
};

export type WsOpMessage = {
  type: 'op';
  boardId: string;
  seq: number;
  from: string;
  op: JsonValue;
};

export type ServerTimerScopeType = 'board' | 'page' | 'section';
export type ServerTimerState = 'running' | 'paused' | 'completed' | 'cancelled' | string;
export type ServerTimerAction = 'start' | 'pause' | 'resume' | 'reset' | 'cancel' | 'complete';

export type ServerTimerScope = {
  type?: ServerTimerScopeType;
  ref?: string | null;
};

export type ClientTimerControlPayload = {
  action: ServerTimerAction;
  timerId?: string;
  durationMs?: number;
  label?: string | null;
  scope?: ServerTimerScope;
};

export type ServerTimerStatePayload = {
  timerId: string;
  state: ServerTimerState;
  durationMs: number;
  remainingMs: number;
  startedAt?: string | null;
  endsAt?: string | null;
  updatedAt: string;
  createdAt: string;
  controllerUserId: string;
  label?: string | null;
  scope: {
    type: ServerTimerScopeType;
    ref?: string | null;
  };
};

export type ClientReactionPayload = {
  reactionType: string;
  durationMs?: number;
  scope?: Record<string, JsonValue>;
};

export type WsEphemeralMessage = {
  type: 'ephemeral';
  boardId: string;
  connectionId?: string | null;
  from: string;
  eventType: 'cursor' | 'viewport' | 'follow' | 'presence-meta' | 'reaction' | 'timer-control' | 'timer-state';
  payload: JsonValue;
  cleared?: boolean;
};

export type WsErrorMessage = {
  type: 'error';
  code: string;
  message: string;
};

export type JavaWhiteboardServerWsMessage =
  | WsJoinedMessage
  | WsPresenceMessage
  | WsOpMessage
  | WsEphemeralMessage
  | WsErrorMessage;
