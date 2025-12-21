import { MAX_MESSAGE_BYTES, MAX_OBJECTS_PER_BOARD } from "../../../shared/protocol/limits";
import {
  parseAndValidateClientMessage,
  utf8ByteLength,
  type ClientJoinMessage,
  type ClientToServerMessage,
  type ServerToClientMessage,
  type BoardRole,
} from "../../../shared/protocol";
import {
  applyEvent,
  createEmptyWhiteboardState,
  type BoardEvent,
  type WhiteboardMeta,
  type WhiteboardState,
} from "../../../shared/domain";

import {
  fetchBoardOwner,
  fetchInviteByTokenHash,
  fetchSupabaseUserFromJwt,
  fetchBoardInfo,
  fetchLatestSnapshot,
  insertSnapshot,
  updateBoardSnapshotSeq,
  sha256Hex,
} from "./supabase";


function normalizeInviteToken(raw: string): string {
  let t = (raw ?? '').trim();

  // If someone accidentally passed a full URL, extract ?invite=...
  try {
    if (t.startsWith('http://') || t.startsWith('https://')) {
      const u = new URL(t);
      const q = u.searchParams.get('invite');
      if (q) t = q;
      // Also support #invite=...
      const h = u.hash?.startsWith('#') ? u.hash.slice(1) : u.hash;
      const m = /(?:^|&)invite=([^&]+)/.exec(h || '');
      if (!q && m?.[1]) t = decodeURIComponent(m[1]);
    }
  } catch {
    // ignore
  }

  // Support raw "invite=TOKEN"
  if (t.startsWith('invite=')) {
    t = decodeURIComponent(t.slice('invite='.length));
  }
  return t.trim();
}

/**
 * Environment bindings for the collaboration worker.
 * In Cloudflare, Durable Objects are bound via wrangler.toml [[durable_objects.bindings]].
 */
export interface Env {
  BOARD_ROOM: DurableObjectNamespace;

  // Supabase configuration (server-side).
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  /**
   * Optional allowlist for websocket origins.
   * Comma-separated list of allowed origins, e.g. "https://example.com,https://staging.example.com".
   * If empty/undefined, all origins are allowed (NOT recommended for production).
   */
  ALLOWED_ORIGINS?: string;
}

function isAllowedOrigin(request: Request, allowedOriginsCsv?: string): boolean {
  const origin = request.headers.get("Origin") ?? "";
  if (!allowedOriginsCsv || allowedOriginsCsv.trim() === "") return true;

  const allowed = allowedOriginsCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return allowed.length === 0 ? true : allowed.includes(origin);
}

function parseBoardIdFromPath(pathname: string): string | null {
  // Expected: /collab/:boardId (boardId is treated as an opaque string here)
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 2 && parts[0] === "collab") return parts[1];
  return null;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const boardId = parseBoardIdFromPath(url.pathname);
    if (!boardId) return new Response("Not Found", { status: 404 });

    if (!isAllowedOrigin(request, env.ALLOWED_ORIGINS)) {
      return new Response("Forbidden (origin)", { status: 403 });
    }

    const id = env.BOARD_ROOM.idFromName(boardId);
    const stub = env.BOARD_ROOM.get(id);
    return stub.fetch(request);
  },
};

type ClientMeta = {
  joined: boolean;
  role?: BoardRole;
  userId?: string;
  guestId?: string;
  displayName?: string;
  color?: string;
};

const JOIN_TIMEOUT_MS = 10_000;
const MAX_JOIN_ATTEMPTS_PER_MINUTE_PER_IP = 30;
const MAX_OPS_PER_10S_PER_CLIENT = 200;
const OP_WINDOW_MS = 10_000;
const MAX_PRESENCE_PER_10S_PER_CLIENT = 100;
const PRESENCE_WINDOW_MS = 10_000;
const PROCESSED_OP_TTL_MS = 5 * 60_000;

const SNAPSHOT_OP_INTERVAL = 50;
const SNAPSHOT_TIME_MS = 10_000;
const SNAPSHOT_MIN_RETRY_MS = 5_000;


function getConnectingIp(request: Request): string {
  // Cloudflare sets CF-Connecting-IP in production. Wrangler/local may not.
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("x-forwarded-for") ||
    "unknown"
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function sendJson(ws: WebSocket, msg: ServerToClientMessage | { type: "hello"; maxMessageBytes: number } | { type: "ack" }) {
  ws.send(JSON.stringify(msg));
}

function closeWithError(ws: WebSocket, boardId: string, message: string, code: number = 1008) {
  try {
    const errMsg: ServerToClientMessage = { type: "error", boardId, code: "forbidden", message };
    ws.send(JSON.stringify(errMsg));
  } catch {
    // ignore
  }
  try {
    ws.close(code, message);
  } catch {
    // ignore
  }
}

export class BoardRoom implements DurableObject {
  private sockets = new Set<WebSocket>();
  private metaBySocket = new WeakMap<WebSocket, ClientMeta>();
  private joinAttemptsByIp = new Map<string, { count: number; resetAt: number }>();


private boardSeq = 0;
private boardState: WhiteboardState | null = null;
private boardLoaded = false;
private boardLoading: Promise<void> | null = null;

// Snapshot persistence cadence.
private opsSinceSnapshot = 0;
private lastSnapshotPersistAt = 0;
private lastSnapshotAttemptAt = 0;
private snapshotPersisting: Promise<void> | null = null;

// Idempotency: remember processed clientOpIds for a short TTL so retries don't duplicate edits.
private processedOps = new Map<
  string,
  { seq: number; op: BoardEvent; authorId: string; processedAt: number }
>();

// Presence (ephemeral) keyed by userId/guestId.
private presenceByUserId = new Map<string, unknown>();

// Simple per-connection op rate limiting
private opRateBySocket = new WeakMap<WebSocket, { windowStart: number; count: number }>();

// Simple per-connection presence rate limiting
private presenceRateBySocket = new WeakMap<WebSocket, { windowStart: number; count: number }>();

  constructor(private state: DurableObjectState, private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const url = new URL(request.url);
    const boardId = parseBoardIdFromPath(url.pathname);
    if (!boardId) return new Response("Not Found", { status: 404 });

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();
    this.sockets.add(server);
    this.metaBySocket.set(server, { joined: false });

    // Small hello for quick manual testing.
    sendJson(server, { type: "hello", maxMessageBytes: MAX_MESSAGE_BYTES });

    // Close if join doesn't happen quickly (basic abuse control / resource cleanup).
    const joinTimeout = setTimeout(() => {
      const meta = this.metaBySocket.get(server);
      if (meta && !meta.joined) {
        closeWithError(server, boardId, "Join timeout");
      }
    }, JOIN_TIMEOUT_MS);

    const ip = getConnectingIp(request);

    server.addEventListener("message", async (evt: any) => {
      const data = evt?.data;

      // Basic payload size guard (approx).
      if (typeof data === "string" && utf8ByteLength(data) > MAX_MESSAGE_BYTES) {
        closeWithError(server, boardId, "Message too large", 1009);
        return;
      }

      if (typeof data !== "string") {
        closeWithError(server, boardId, "Binary messages not supported");
        return;
      }

      const parsed = parseAndValidateClientMessage(data, MAX_MESSAGE_BYTES);
      if (!parsed.ok) {
        closeWithError(server, boardId, parsed.error);
        return;
      }

      const msg = parsed.value;

      const meta = this.metaBySocket.get(server) ?? { joined: false };
      if (!meta.joined) {
        if (msg.type !== "join") {
          closeWithError(server, boardId, "Must join first");
          return;
        }

        // coarse join rate limit per ip (counts only failed joins; reset on success)
        if (!this.allowJoin(ip)) {
          closeWithError(server, boardId, "Too many join attempts; try again later");
          return;
        }

        try {
          const authResult = await this.validateJoin(msg, boardId);
          this.clearJoinFailures(ip);
          clearTimeout(joinTimeout);

          const updated: ClientMeta = {
            joined: true,
            role: authResult.role,
            userId: authResult.userId,
            guestId: authResult.guestId,
            displayName: authResult.displayName,
            color: authResult.color,
          };
          this.metaBySocket.set(server, updated);

          // For Step 5 we don't yet have snapshots/seq; respond with minimal joined message.
          
// Ensure the authoritative state exists (Step 6). For now we start with an empty board state;
// Step 7 will load snapshots from Supabase.
await this.ensureLoaded(boardId);

const joined: ServerToClientMessage = {
  type: "joined",
  boardId,
  role: updated.role!,
  seq: this.boardSeq,
  snapshot: this.boardState,
  snapshotSeq: this.boardSeq,
  users: this.getUsersForPresence(),
};
          sendJson(server, joined);

          // Broadcast presence roster update to others (lightweight).
          this.broadcastUsers(boardId);

          return;
        } catch (e: any) {
          this.recordJoinFailure(ip);
          closeWithError(server, boardId, e?.message ?? "Join rejected");
          return;
        }
      }

      
// Already joined: handle ops and presence with authoritative sequencing (Step 6).
// Security hardening: ensure message boardId matches room boardId.
if ((msg as any).boardId && (msg as any).boardId !== boardId) {
  closeWithError(server, boardId, "BoardId mismatch");
  return;
}

if (msg.type === "op") {
  if (meta.role === "viewer") {
    const err: ServerToClientMessage = {
      type: "error",
      boardId,
      code: "forbidden",
      message: "Viewer cannot send ops",
    };
    sendJson(server, err);
    return;
  }

  // Ensure we have an in-memory board state.
  await this.ensureLoaded(boardId);

  // Guardrail: prevent unbounded growth over time.
  if ((msg.op as any)?.type === 'objectCreated') {
    const incomingObjId = (msg.op as any)?.payload?.object?.id as string | undefined;
    if (this.boardState!.objects.length >= MAX_OBJECTS_PER_BOARD) {
      const err: ServerToClientMessage = {
        type: 'error',
        boardId,
        code: 'forbidden',
        message: 'Board is too large to accept more objects',
      };
      sendJson(server, err);
      return;
    }
    if (incomingObjId && this.boardState!.objects.some((o) => o.id === incomingObjId)) {
      const err: ServerToClientMessage = {
        type: 'error',
        boardId,
        code: 'forbidden',
        message: 'Duplicate object id',
      };
      sendJson(server, err);
      return;
    }
  }

  // Basic per-connection op rate limiting.
  if (!this.consumeOp(server)) {
    const err: ServerToClientMessage = {
      type: "error",
      boardId,
      code: "rate_limited",
      message: "Too many ops; slow down",
    };
    sendJson(server, err);
    return;
  }

  // Idempotency: if we've already processed this clientOpId, re-send the canonical server op to this client.
  const existing = this.processedOps.get(msg.clientOpId);
  if (existing) {
    const replay: ServerToClientMessage = {
      type: "op",
      boardId,
      seq: existing.seq,
      op: existing.op,
      authorId: existing.authorId,
      clientOpId: msg.clientOpId,
    };
    sendJson(server, replay);
    return;
  }

  // Clean up old processed ops (best-effort).
  this.gcProcessedOps();

  const authorId = meta.userId ?? meta.guestId ?? "unknown";

// Assign authoritative order.
// NOTE: we increment seq only after we are sure we can apply the op.
const op = msg.op as BoardEvent;
let nextState: WhiteboardState;
try {
  nextState = applyEvent(this.boardState!, op);
} catch {
  const err: ServerToClientMessage = {
    type: "error",
    boardId,
    code: "forbidden",
    message: "Op rejected",
  };
  sendJson(server, err);
  return;
}

this.boardSeq += 1;
const seq = this.boardSeq;
this.boardState = nextState;

  // Remember for idempotency.
  this.processedOps.set(msg.clientOpId, {
    seq,
    op,
    authorId,
    processedAt: Date.now(),
  });

  // Broadcast the ordered op to all joined clients.
  const out: ServerToClientMessage = {
    type: "op",
    boardId,
    seq,
    op,
    authorId,
    clientOpId: msg.clientOpId,
  };
  this.broadcastJson(out);

  // Snapshot durability (Step 7): persist periodically.
  this.opsSinceSnapshot += 1;
  await this.maybePersistSnapshot(boardId);
  return;
}


if (msg.type === "presence") {
  // Basic per-connection presence rate limiting.
  if (!this.consumePresence(server)) {
    const err: ServerToClientMessage = {
      type: "error",
      boardId,
      code: "rate_limited",
      message: "Too many presence updates; slow down",
    };
    sendJson(server, err);
    return;
  }

  const userKey = meta.userId ?? meta.guestId;
  if (userKey) {
    this.presenceByUserId.set(userKey, msg.presence);
  }
  // Broadcast full presence roster snapshot (simple, deterministic).
  this.broadcastUsers(boardId);
  return;
}

if (msg.type === "ping") {
  sendJson(server, { type: "pong", t: msg.t });
  return;
}
    });

    
const cleanup = () => {
  clearTimeout(joinTimeout);
  const meta = this.metaBySocket.get(server);
  if (meta) {
    const key = meta.userId ?? meta.guestId;
    if (key) this.presenceByUserId.delete(key);
    this.metaBySocket.delete(server);
  }
  this.sockets.delete(server);
  // roster update
  this.broadcastUsers(boardId);
};

    server.addEventListener("close", cleanup);
    server.addEventListener("error", cleanup);

    return new Response(null, { status: 101, webSocket: client as any } as any);
  }

  private broadcastRaw(payload: string) {
    for (const ws of this.sockets) {
      try {
        ws.send(payload);
      } catch {
        // ignore
      }
    }
  }

  private broadcastUsers(boardId: string) {
    const users = this.getJoinedUsers().map((u) => ({
      userId: u.userId ?? u.guestId ?? "unknown",
      displayName: u.displayName ?? "Guest",
      color: u.color,
      role: u.role,
    }));

    const presenceByUserId = Object.fromEntries(this.presenceByUserId.entries()) as Record<string, any>;

    const msg: ServerToClientMessage = { type: "presence", boardId, users, presenceByUserId };
    const payload = JSON.stringify(msg);

    for (const ws of this.sockets) {
      const meta = this.metaBySocket.get(ws);
      if (!meta?.joined) continue;
      try {
        ws.send(payload);
      } catch {
        // ignore
      }
    }
  }

  private getJoinedUsers(): Array<Required<Pick<ClientMeta, "joined">> & {
    role: BoardRole;
    userId?: string;
    guestId?: string;
    displayName?: string;
    color?: string;
  }> {
    const out: any[] = [];
    for (const ws of this.sockets) {
      const m = this.metaBySocket.get(ws);
      if (!m?.joined || !m.role) continue;
      out.push({ joined: true, role: m.role, userId: m.userId, guestId: m.guestId, displayName: m.displayName, color: m.color });
    }
    return out;
  }

private getUsersForPresence() {
  return this.getJoinedUsers().map((u) => ({
    userId: u.userId ?? u.guestId ?? "unknown",
    displayName: u.displayName ?? "Guest",
    color: u.color,
    role: u.role,
  }));
}


  private allowJoin(ip: string): boolean {
  const now = Date.now();
  const rec = this.joinAttemptsByIp.get(ip);
  if (!rec || now >= rec.resetAt) return true;
  return rec.count < MAX_JOIN_ATTEMPTS_PER_MINUTE_PER_IP;
}

private recordJoinFailure(ip: string): void {
  const now = Date.now();
  const rec = this.joinAttemptsByIp.get(ip);
  if (!rec || now >= rec.resetAt) {
    this.joinAttemptsByIp.set(ip, { count: 1, resetAt: now + 60_000 });
    return;
  }
  rec.count += 1;
}

private clearJoinFailures(ip: string): void {
  this.joinAttemptsByIp.delete(ip);
}

  

private async ensureLoaded(boardId: string): Promise<void> {
  if (this.boardLoaded) return;

  if (this.boardLoading) {
    await this.boardLoading;
    return;
  }

  this.boardLoading = (async () => {
    // Fetch board info for metadata (title/type/timestamps).
    const info = await fetchBoardInfo(this.env, boardId);
    if (!info) {
      // Board should exist (validateJoin checks), but fall back safely.
      this.ensureBoardState(boardId);
      this.boardLoaded = true;
      this.lastSnapshotPersistAt = Date.now();
      return;
    }

    const latest = await fetchLatestSnapshot(this.env, boardId);

    if (latest && latest.snapshot_json && typeof latest.snapshot_json === "object") {
      // We store the full WhiteboardState as snapshot_json.
      const snap = latest.snapshot_json as any;
      this.boardState = snap as WhiteboardState;
      this.boardSeq = latest.seq;

      // Ensure meta fields are sane.
      if (this.boardState?.meta) {
        this.boardState = {
          ...this.boardState,
          meta: {
            ...this.boardState.meta,
            id: boardId,
            name: (this.boardState.meta.name && this.boardState.meta.name !== 'Untitled board') ? this.boardState.meta.name : info.title,
          },
          selectedObjectIds: [],
        };
      }
    } else {
      // No snapshot yet; create an empty board state based on DB metadata.
      const meta: WhiteboardMeta = {
        id: boardId,
        name: info.title,
        boardType:
          info.board_type === 'advanced' || info.board_type === 'freehand' || info.board_type === 'mindmap'
            ? info.board_type
            : 'advanced',
        createdAt: info.created_at,
        updatedAt: info.updated_at,
      };
      this.boardState = createEmptyWhiteboardState(meta);
      this.boardSeq = info.snapshot_seq ?? 0;
    }

    this.boardLoaded = true;
    this.lastSnapshotPersistAt = Date.now();
  })();

  try {
    await this.boardLoading;
  } finally {
    this.boardLoading = null;
  }
}

private shouldPersistSnapshot(): boolean {
  if (!this.boardState) return false;
  if (this.opsSinceSnapshot >= SNAPSHOT_OP_INTERVAL) return true;
  if (this.opsSinceSnapshot > 0 && Date.now() - this.lastSnapshotPersistAt >= SNAPSHOT_TIME_MS) return true;
  return false;
}

private sanitizeSnapshotState(state: WhiteboardState): WhiteboardState {
  // Persist only durable board content; do not persist ephemeral selections or undo/redo history.
  return {
    ...state,
    selectedObjectIds: [],
    history: {
      pastEvents: [],
      futureEvents: [],
    },
  };
}

private async maybePersistSnapshot(boardId: string): Promise<void> {
  if (!this.boardState) return;
  if (!this.shouldPersistSnapshot()) return;

  const now = Date.now();
  if (now - this.lastSnapshotAttemptAt < SNAPSHOT_MIN_RETRY_MS) return;
  this.lastSnapshotAttemptAt = now;

  if (this.snapshotPersisting) {
    // If a snapshot is already in-flight, don't start another.
    return;
  }

  const seq = this.boardSeq;
  const snapshotJson = this.sanitizeSnapshotState(this.boardState);

  this.snapshotPersisting = (async () => {
    await insertSnapshot(this.env, boardId, seq, snapshotJson);
    await updateBoardSnapshotSeq(this.env, boardId, seq);
  })();

  try {
    await this.snapshotPersisting;
    this.lastSnapshotPersistAt = Date.now();
    this.opsSinceSnapshot = 0;
  } catch (e) {
    // Don't crash the room if persistence fails; we'll retry later.
    console.warn("Snapshot persist failed:", e);
  } finally {
    this.snapshotPersisting = null;
  }
}

private ensureBoardState(boardId: string) {
  if (this.boardState) return;
  const meta: WhiteboardMeta = {
    id: boardId,
    name: "Untitled",
    boardType: "advanced",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  this.boardState = createEmptyWhiteboardState(meta);
  this.boardSeq = 0;
}

private consumeOp(ws: WebSocket): boolean {
  const now = Date.now();
  const cur = this.opRateBySocket.get(ws);
  if (!cur || now - cur.windowStart >= OP_WINDOW_MS) {
    this.opRateBySocket.set(ws, { windowStart: now, count: 1 });
    return true;
  }
  if (cur.count >= MAX_OPS_PER_10S_PER_CLIENT) return false;
  cur.count += 1;
  return true;
}

private consumePresence(ws: WebSocket): boolean {
  const now = Date.now();
  const cur = this.presenceRateBySocket.get(ws);
  if (!cur || now - cur.windowStart >= PRESENCE_WINDOW_MS) {
    this.presenceRateBySocket.set(ws, { windowStart: now, count: 1 });
    return true;
  }
  if (cur.count >= MAX_PRESENCE_PER_10S_PER_CLIENT) return false;
  cur.count += 1;
  return true;
}



private gcProcessedOps() {
  const cutoff = Date.now() - PROCESSED_OP_TTL_MS;
  for (const [clientOpId, v] of this.processedOps) {
    if (v.processedAt < cutoff) this.processedOps.delete(clientOpId);
  }
}

private broadcastJson(msg: ServerToClientMessage) {
  const payload = JSON.stringify(msg);
  for (const ws of this.sockets) {
    const meta = this.metaBySocket.get(ws);
    if (!meta?.joined) continue;
    try {
      ws.send(payload);
    } catch {
      // ignore
    }
  }
}

private async validateJoin(msg: ClientJoinMessage, boardId: string): Promise<{
    role: BoardRole;
    userId?: string;
    guestId?: string;
    displayName?: string;
    color?: string;
  }> {
    // Basic invariant: message boardId must match URL boardId.
    if (msg.boardId !== boardId) {
      throw new Error("BoardId mismatch");
    }

    // Client presentation preferences (not trusted identity).
    const guestId = msg.client?.guestId;
    const displayName = msg.client?.displayName;
    const color = msg.client?.color;

    if (msg.auth.kind === "owner") {
      const user = await fetchSupabaseUserFromJwt(this.env, msg.auth.supabaseJwt);
      if (!user) throw new Error("Invalid owner token");

      const board = await fetchBoardOwner(this.env, boardId);
      if (!board) throw new Error("Board not found");

      if (board.owner_user_id !== user.id) {
        throw new Error("Not board owner");
      }

      return { role: "owner", userId: user.id, guestId, displayName, color };
    }

    if (msg.auth.kind === "invite") {
      // For now we store and validate invite tokens by hashing them with SHA-256 hex.
      const tokenHash = await sha256Hex(normalizeInviteToken(msg.auth.inviteToken));
      const invite = await fetchInviteByTokenHash(this.env, boardId, tokenHash);
      if (!invite) throw new Error("Invalid invite token");
      if (invite.revoked_at) throw new Error("Invite revoked");
      if (invite.expires_at) {
        const exp = Date.parse(invite.expires_at);
        if (!Number.isNaN(exp) && Date.now() > exp) throw new Error("Invite expired");
      }
      const role: BoardRole = invite.role;
      return { role, guestId, displayName, color };
    }

    throw new Error("Unsupported auth kind");
  }
}
