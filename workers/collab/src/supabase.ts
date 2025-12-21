import type { Env } from "./index";

function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export type SupabaseUser = { id: string };

export async function fetchSupabaseUserFromJwt(env: Env, jwt: string): Promise<SupabaseUser | null> {
  // Uses Supabase Auth endpoint to validate the JWT and return the associated user.
  const base = normalizeBaseUrl(env.SUPABASE_URL);
  const res = await fetch(`${base}/auth/v1/user`, {
    headers: {
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "authorization": `Bearer ${jwt}`,
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Invite lookup failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  const data = await res.json() as any;
  if (!data || typeof data.id !== "string") return null;
  return { id: data.id };
}

export type BoardOwnerRow = { owner_user_id: string };

export async function fetchBoardOwner(env: Env, boardId: string): Promise<BoardOwnerRow | null> {
  const base = normalizeBaseUrl(env.SUPABASE_URL);
  const url = new URL(`${base}/rest/v1/boards`);
  url.searchParams.set("select", "owner_user_id");
  url.searchParams.set("id", `eq.${boardId}`);
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: {
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      // Access the custom schema through PostgREST profiles.
      "accept-profile": "whiteboard",
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Invite lookup failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  const rows = await res.json() as any[];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const r = rows[0];
  if (!r || typeof r.owner_user_id !== "string") return null;
  return { owner_user_id: r.owner_user_id };
}

export type InviteRow = {
  role: "viewer" | "editor";
  expires_at: string | null;
  revoked_at: string | null;
};

export async function fetchInviteByTokenHash(env: Env, boardId: string, tokenHash: string): Promise<InviteRow | null> {
  const base = normalizeBaseUrl(env.SUPABASE_URL);
  const url = new URL(`${base}/rest/v1/board_invites`);
  url.searchParams.set("select", "role,expires_at,revoked_at");
  url.searchParams.set("board_id", `eq.${boardId}`);
  url.searchParams.set("token_hash", `eq.${tokenHash}`);
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: {
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "accept-profile": "whiteboard",
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Invite lookup failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  const rows = await res.json() as any[];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const r = rows[0];
  if (!r || (r.role !== "viewer" && r.role !== "editor")) return null;
  return {
    role: r.role,
    expires_at: typeof r.expires_at === "string" ? r.expires_at : null,
    revoked_at: typeof r.revoked_at === "string" ? r.revoked_at : null,
  };
}


export type BoardInfoRow = {
  id: string;
  owner_user_id: string;
  title: string;
  board_type: string | null;
  created_at: string;
  updated_at: string;
  snapshot_seq: number;
};

export async function fetchBoardInfo(env: Env, boardId: string): Promise<BoardInfoRow | null> {
  const base = normalizeBaseUrl(env.SUPABASE_URL);
  const url = new URL(`${base}/rest/v1/boards`);
  url.searchParams.set("select", "id,owner_user_id,title,board_type,created_at,updated_at,snapshot_seq");
  url.searchParams.set("id", `eq.${boardId}`);
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: {
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "accept-profile": "whiteboard",
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Invite lookup failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  const rows = (await res.json()) as any[];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const r = rows[0];
  if (!r || typeof r.id !== "string" || typeof r.owner_user_id !== "string" || typeof r.title !== "string") return null;
  return {
    id: r.id,
    owner_user_id: r.owner_user_id,
    title: r.title,
    board_type: typeof r.board_type === "string" ? r.board_type : null,
    created_at: typeof r.created_at === "string" ? r.created_at : new Date().toISOString(),
    updated_at: typeof r.updated_at === "string" ? r.updated_at : new Date().toISOString(),
    snapshot_seq: typeof r.snapshot_seq === "number" ? r.snapshot_seq : 0,
  };
}

export type LatestSnapshotRow = {
  seq: number;
  snapshot_json: unknown;
};

export async function fetchLatestSnapshot(env: Env, boardId: string): Promise<LatestSnapshotRow | null> {
  const base = normalizeBaseUrl(env.SUPABASE_URL);
  const url = new URL(`${base}/rest/v1/board_snapshots`);
  url.searchParams.set("select", "seq,snapshot_json");
  url.searchParams.set("board_id", `eq.${boardId}`);
  url.searchParams.set("order", "seq.desc");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: {
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "accept-profile": "whiteboard",
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Invite lookup failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  const rows = (await res.json()) as any[];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const r = rows[0];
  if (!r || typeof r.seq !== "number") return null;
  return { seq: r.seq, snapshot_json: r.snapshot_json };
}

export async function insertSnapshot(env: Env, boardId: string, seq: number, snapshotJson: unknown): Promise<void> {
  const base = normalizeBaseUrl(env.SUPABASE_URL);
  const res = await fetch(`${base}/rest/v1/board_snapshots`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-profile": "whiteboard",
      "prefer": "return=minimal",
    },
    body: JSON.stringify([{ board_id: boardId, seq, snapshot_json: snapshotJson }]),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Failed to insert snapshot (${res.status}): ${txt}`);
  }
}

export async function updateBoardSnapshotSeq(env: Env, boardId: string, seq: number): Promise<void> {
  const base = normalizeBaseUrl(env.SUPABASE_URL);
  const url = new URL(`${base}/rest/v1/boards`);
  url.searchParams.set("id", `eq.${boardId}`);

  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-profile": "whiteboard",
      "prefer": "return=minimal",
    },
    body: JSON.stringify({ snapshot_seq: seq }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Failed to update boards.snapshot_seq (${res.status}): ${txt}`);
  }
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const arr = new Uint8Array(digest);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}
