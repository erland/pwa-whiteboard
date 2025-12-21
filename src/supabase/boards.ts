import type { SupabaseClient } from '@supabase/supabase-js';

export type EnsureBoardRowResult =
  | { ok: true; created: boolean }
  | { ok: false; message: string };

export async function ensureBoardRowInSupabase(args: {
  client: SupabaseClient;
  boardId: string;
  ownerUserId: string;
  title: string;
}): Promise<EnsureBoardRowResult> {
  const { client, boardId, ownerUserId, title } = args;

  const { data: existing, error: selErr } = await client
    .schema('whiteboard')
    .from('boards')
    .select('id, owner_user_id')
    .eq('id', boardId)
    .maybeSingle();

  if (!selErr && existing && existing.owner_user_id !== ownerUserId) {
    return { ok: false, message: 'You are signed in, but you are not the owner of this board in Supabase.' };
  }

  if (existing) return { ok: true, created: false };

  const { error: insErr } = await client
    .schema('whiteboard')
    .from('boards')
    .upsert(
      {
        id: boardId,
        owner_user_id: ownerUserId,
        title,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );

  if (insErr) {
    const msg = insErr.message || '';
    // If two requests race, we may attempt to create the same row twice.
    // Treat duplicate-key as success.
    if (msg.includes('duplicate key') || msg.includes('boards_pkey')) {
      return { ok: true, created: false };
    }
    return { ok: false, message: `Could not create board in Supabase: ${msg}` };
  }

  return { ok: true, created: true };
}

export async function updateBoardTitleInSupabase(args: {
  client: SupabaseClient;
  boardId: string;
  title: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { client, boardId, title } = args;

  const { error } = await client
    .schema('whiteboard')
    .from('boards')
    .update({ title })
    .eq('id', boardId);

  if (error) return { ok: false, message: error.message || String(error) };
  return { ok: true };
}
