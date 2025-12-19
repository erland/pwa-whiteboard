import { MAX_MESSAGE_BYTES } from "../../../shared/protocol/limits";
import {
  parseAndValidateClientMessage,
  type ClientJoinMessage,
  type ClientToServerMessage,
  type ServerToClientMessage,
  type BoardRole,
} from "../../../shared/protocol";
import {
  fetchBoardOwner,
  fetchInviteByTokenHash,
  fetchSupabaseUserFromJwt,
  sha256Hex,
} from "./supabase";

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
      if (typeof data === "string" && data.length > MAX_MESSAGE_BYTES) {
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

        // coarse join rate limit per ip
        if (!this.consumeJoinAttempt(ip)) {
          closeWithError(server, boardId, "Too many join attempts; try again later");
          return;
        }

        try {
          const authResult = await this.validateJoin(msg, boardId);
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
          const joined: ServerToClientMessage = {
            type: "joined",
            boardId,
            role: authResult.role,
            seq: 0,
            users: [
              ...this.getJoinedUsers().map((u) => ({
                userId: u.userId,
                guestId: u.guestId,
                displayName: u.displayName,
                color: u.color,
                role: u.role,
                lastSeenAt: nowIso(),
              })),
            ],
          };
          sendJson(server, joined);

          // Broadcast presence roster update to others (lightweight).
          this.broadcastUsers(boardId);

          return;
        } catch (e: any) {
          closeWithError(server, boardId, e?.message ?? "Join rejected");
          return;
        }
      }

      // Already joined: for now keep simple behavior until Step 6.
      if (msg.type === "op") {
        if (meta.role === "viewer") {
          const err: ServerToClientMessage = { type: "error", boardId, code: "forbidden", message: "Viewer cannot send ops" };
          sendJson(server, err);
          return;
        }
        // Broadcast the op as-is (Step 6 will add ordering + validation + seq).
        this.broadcastRaw(data);
        return;
      }

      if (msg.type === "presence") {
        // For Step 5, just broadcast presence messages to others (ephemeral).
        this.broadcastRaw(data);
        return;
      }

      if (msg.type === "ping") {
        const pong: ServerToClientMessage = { type: "pong", boardId, t: msg.t };
        sendJson(server, pong);
        return;
      }
    });

    const cleanup = () => {
      clearTimeout(joinTimeout);
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
      userId: u.userId,
      guestId: u.guestId,
      displayName: u.displayName,
      color: u.color,
      role: u.role,
      lastSeenAt: nowIso(),
    }));

    const msg: ServerToClientMessage = { type: "presence", boardId, users };
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

  private consumeJoinAttempt(ip: string): boolean {
    const now = Date.now();
    const rec = this.joinAttemptsByIp.get(ip);
    if (!rec || now >= rec.resetAt) {
      this.joinAttemptsByIp.set(ip, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    rec.count += 1;
    if (rec.count > MAX_JOIN_ATTEMPTS_PER_MINUTE_PER_IP) return false;
    return true;
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
      const tokenHash = await sha256Hex(msg.auth.inviteToken);
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
