import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

function getEnv() {
  const url = (globalThis as any).__VITE_SUPABASE_URL as string | undefined;
  const anonKey = (globalThis as any).__VITE_SUPABASE_ANON_KEY as string | undefined;
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getEnv();
  return Boolean(url && anonKey);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (client) return client;

  const { url, anonKey } = getEnv();
  if (!url || !anonKey) return null;

  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return client;
}

/**
 * Supabase magic-link flows often return to your site with tokens in the URL hash/query.
 * If we never initialize Supabase early, React Router navigation can clear the URL
 * before supabase-js gets a chance to persist the session.
 */
export async function initSupabaseAuthFromUrl(): Promise<void> {
  const c = getSupabaseClient();
  if (!c) return;
  // Touch the session to ensure detectSessionInUrl runs.
  await c.auth.getSession();
}
