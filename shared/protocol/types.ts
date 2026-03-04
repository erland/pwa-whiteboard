import type { BoardEvent } from '../domain';

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

export type WhiteboardOp = BoardEvent;

// ----------------------------
// Client -> Server messages
// ----------------------------

export type ClientOpMessage = {
  type: 'op';
  /** Optional client-generated id used only for correlation; server may ignore it. */
  clientOpId?: string;
  /** Optional optimistic hint; server may ignore it. */
  baseSeq?: number;
  op: WhiteboardOp;
};

export type ClientPingMessage = {
  type: 'ping';
  t: number;
};

export type ClientToServerMessage =
  | ClientOpMessage
  | ClientPingMessage;

// ----------------------------
// Server -> Client messages
// ----------------------------

export type ServerJoinedMessage = {
  type: 'joined';
  boardId: string;
  /** Authenticated user id (JWT subject). */
  userId: string;
  /** Role for this user in the board (normalized to lowercase). */
  role: BoardRole;
  /** Current presence list as user ids (some servers also include richer user objects). */
  presentUserIds?: string[];
  /** Optional pointer (e.g. latest snapshot version). */
  snapshot?: unknown;
  /** Optional full snapshot payload (server-dependent). */
  latestSnapshot?: unknown;
  /** Optional debug timestamp. */
  serverNow?: string;
  /** Back-compat: some servers send users[] instead of presentUserIds. */
  users?: PresenceUser[];
};

export type ServerOpMessage = {
  type: 'op';
  boardId?: string;
  seq: number;
  op: WhiteboardOp;
  authorId?: string;
  /** Echo of the originating client op id (when known). */
  clientOpId?: string;
};

export type ServerPresenceMessage = {
  type: 'presence';
  boardId?: string;
  /** Presence updates (joins/leaves) - server may provide either ids or user objects. */
  presentUserIds?: string[];
  users?: PresenceUser[];
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
    | 'server_error'
    | 'board_too_large'
    | 'stroke_too_long'
    | 'text_too_long';
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
