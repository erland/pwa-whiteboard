// src/supabase/getSupabaseClient.ts
//
// Note: This uses a dynamic import to avoid Jest/ts-jest ESM issues in tests.
// The module is only loaded when actually used at runtime.

export type SupabaseClientLike = any;

let clientPromise: Promise<SupabaseClientLike | null> | null = null;

function getSupabaseConfig(): { url: string; anonKey: string } | null {
  const url = (globalThis as any).__VITE_SUPABASE_URL as string | undefined;
  const anonKey = (globalThis as any).__VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export async function getSupabaseClient(): Promise<SupabaseClientLike | null> {
  const cfg = getSupabaseConfig();
  if (!cfg) return null;
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then((m: any) => m.createClient(cfg.url, cfg.anonKey));
  }
  return clientPromise;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}
