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
  if (!res.ok) return null;
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
  if (!res.ok) return null;
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
  if (!res.ok) return null;
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

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const arr = new Uint8Array(digest);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}
