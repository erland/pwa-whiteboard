import { MAX_MESSAGE_BYTES } from "../../../shared/protocol/limits";

/**
 * Environment bindings for the collaboration worker.
 * In Cloudflare, Durable Objects are bound via wrangler.toml [[durable_objects.bindings]].
 */
export interface Env {
  BOARD_ROOM: DurableObjectNamespace;

  // Supabase configuration (used in later steps).
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  INVITE_SIGNING_SECRET?: string;
  ALLOWED_ORIGINS?: string;
}

function isAllowedOrigin(request: Request, allowedOriginsCsv?: string): boolean {
  if (!allowedOriginsCsv) return true;
  const origin = request.headers.get("Origin");
  if (!origin) return true; // non-browser / same-origin navigation
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
    if (!boardId) {
      return new Response("Not Found", { status: 404 });
    }

    if (!isAllowedOrigin(request, env.ALLOWED_ORIGINS)) {
      return new Response("Forbidden (origin)", { status: 403 });
    }

    // Route to the Durable Object instance for this board.
    const id = env.BOARD_ROOM.idFromName(boardId);
    const stub = env.BOARD_ROOM.get(id);
    return stub.fetch(request);
  },
};

/**
 * Durable Object representing a single collaboration room (one per board).
 *
 * Step 4 skeleton:
 * - Accept WebSocket upgrades.
 * - Maintain a set of connected sockets.
 * - Echo/broadcast messages as a basic connectivity test.
 *
 * Later steps will add:
 * - join/auth/invite validation,
 * - authoritative sequencing,
 * - snapshots to Supabase,
 * - presence handling,
 * - limits & rate limiting.
 */
export class BoardRoom implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  private sockets: Set<WebSocket> = new Set();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();
    this.sockets.add(server);

    // Send a small hello so local dev can verify connectivity quickly.
    server.send(JSON.stringify({ type: "hello", maxMessageBytes: MAX_MESSAGE_BYTES }));

    server.addEventListener("message", (evt: any) => {
      // Basic payload size guard (approx; later we will validate with shared protocol parsing).
      const data = evt?.data;
      if (typeof data === "string" && data.length > MAX_MESSAGE_BYTES) {
        server.close(1009, "Message too large");
        return;
      }

      // Echo/broadcast to all clients (including sender) for now.
      for (const ws of this.sockets) {
        try {
          ws.send(typeof data === "string" ? data : JSON.stringify({ type: "binary" }));
        } catch {
          // Ignore; close handling will remove dead sockets.
        }
      }
    });

    server.addEventListener("close", () => {
      this.sockets.delete(server);
    });

    server.addEventListener("error", () => {
      this.sockets.delete(server);
    });

    return new Response(null, { status: 101, webSocket: client as any } as any);
  }
}
