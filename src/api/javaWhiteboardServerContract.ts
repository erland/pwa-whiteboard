import type { JsonValue } from './httpClient';

/**
 * Frozen description of the current java-whiteboard-server HTTP + WebSocket wire contract.
 *
 * Purpose:
 * - make the current backend contract explicit in one place
 * - give the client a stable import for request/response DTOs during migration
 * - document the contract as it actually exists today, not as we want it to look later
 *
 * This file intentionally mirrors server naming and field casing.
 */

export type ServerBoardStatus = 'active' | 'archived' | 'deleted' | string;
export type ServerInvitePermission = 'viewer' | 'editor';
export type ServerBoardAccessRole = 'owner' | 'editor' | 'viewer';

export type ServerBoard = {
  id: string;
  name: string;
  type: string;
  ownerUserId: string;
  status: ServerBoardStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateBoardRequest = {
  name: string;
  type: string;
};

export type UpdateBoardRequest = {
  name?: string;
  type?: string;
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

export type WsErrorMessage = {
  type: 'error';
  code: string;
  message: string;
};

export type JavaWhiteboardServerWsMessage =
  | WsJoinedMessage
  | WsPresenceMessage
  | WsOpMessage
  | WsErrorMessage;
