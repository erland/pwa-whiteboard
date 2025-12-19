export type BoardRole = 'owner' | 'editor' | 'viewer';

export type Cursor = { x: number; y: number };

export type ViewportPresence = {
  panX: number;
  panY: number;
  zoom: number;
};

export type PresencePayload = {
  cursor?: Cursor;
  selectionIds?: string[];
  viewport?: ViewportPresence;
  isTyping?: boolean;
};

/**
 * A lightweight, non-sensitive representation of a connected participant.
 *
 * `userId` may be an authenticated user id, or a guest id.
 */
export type PresenceUser = {
  userId: string;
  displayName: string;
  color?: string;
  role: BoardRole;
};

/**
 * Placeholder type for shared ops. In Step 2, this should be replaced by
 * the real WhiteboardEvent/Op type from `shared/domain`.
 */
export type WhiteboardOp = unknown;

// ----------------------------
// Client -> Server messages
// ----------------------------

export type JoinAuth =
  | { kind: 'owner'; supabaseJwt: string }
  | { kind: 'invite'; inviteToken: string };

export type ClientJoinMessage = {
  type: 'join';
  boardId: string;
  /**
   * Optional last sequence number the client believes it has applied.
   * Used as a hint for debugging/sanity checks.
   */
  clientKnownSeq?: number;
  auth: JoinAuth;
  /** Guest/client presentation preferences (not trusted identity). */
  client?: {
    guestId?: string;
    displayName?: string;
    color?: string;
  };
};

export type ClientOpMessage = {
  type: 'op';
  boardId: string;
  clientOpId: string;
  baseSeq: number;
  op: WhiteboardOp;
};

export type ClientPresenceMessage = {
  type: 'presence';
  boardId: string;
  presence: PresencePayload;
};

export type ClientPingMessage = {
  type: 'ping';
  t: number;
};

export type ClientToServerMessage =
  | ClientJoinMessage
  | ClientOpMessage
  | ClientPresenceMessage
  | ClientPingMessage;

// ----------------------------
// Server -> Client messages
// ----------------------------

export type ServerJoinedMessage = {
  type: 'joined';
  boardId: string;
  role: BoardRole;
  /** Current room sequence number. */
  seq: number;
  /** Optional snapshot of the current board state. */
  snapshot?: unknown;
  snapshotSeq?: number;
  users?: PresenceUser[];
};

export type ServerOpMessage = {
  type: 'op';
  boardId: string;
  seq: number;
  op: WhiteboardOp;
  authorId: string;
  /** Echo of the originating client op id (when known). */
  clientOpId?: string;
};

export type ServerPresenceMessage = {
  type: 'presence';
  boardId: string;
  /** Full user list snapshot for now (simple, easy). */
  users: PresenceUser[];
  /** Optional per-user presence payloads. */
  presenceByUserId?: Record<string, PresencePayload>;
};

export type ServerErrorMessage = {
  type: 'error';
  boardId?: string;
  code:
    | 'bad_request'
    | 'unauthorized'
    | 'forbidden'
    | 'not_found'
    | 'rate_limited'
    | 'payload_too_large'
    | 'server_error';
  message: string;
  fatal?: boolean;
};

export type ServerPongMessage = {
  type: 'pong';
  t: number;
};

export type ServerToClientMessage =
  | ServerJoinedMessage
  | ServerOpMessage
  | ServerPresenceMessage
  | ServerErrorMessage
  | ServerPongMessage;
