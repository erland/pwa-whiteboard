import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabaseClient, isSupabaseConfigured } from '../../supabase/supabaseClient';
import { ensureBoardRowInSupabase } from '../../supabase/boards';
import { getBestLocalBoardTitle } from '../../domain/boardTitle';
import { buildInviteUrl, generateInviteToken, sha256Hex } from '../../share/inviteTokens';
import type { WhiteboardMeta, WhiteboardState } from '../../domain/types';
import { createEmptyWhiteboardState } from '../../domain/whiteboardState';
import { getWhiteboardRepository } from '../../infrastructure/localStorageWhiteboardRepository';

type InviteRole = 'viewer' | 'editor';

type ActiveInvite = {
  id: string;
  role: InviteRole;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string | null;
};

type SharePanelProps = {
  boardId: string;
  boardName: string;
};

type ExpiresPreset = '7d' | '30d' | 'never';

function computeExpiresAt(preset: ExpiresPreset): string | null {
  if (preset === 'never') return null;
  const now = new Date();
  const days = preset === '7d' ? 7 : 30;
  now.setDate(now.getDate() + days);
  return now.toISOString();
}


const BOARDS_INDEX_KEY = 'pwa-whiteboard.boardsIndex';

function isUuidLike(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function newUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as any).randomUUID() as string;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function readBoardsIndex(): WhiteboardMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(BOARDS_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WhiteboardMeta[]) : [];
  } catch {
    return [];
  }
}

function writeBoardsIndex(index: WhiteboardMeta[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BOARDS_INDEX_KEY, JSON.stringify(index));
  } catch {
    // ignore
  }
}


async function safeCopy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

export const SharePanel: React.FC<SharePanelProps> = ({ boardId, boardName }) => {
  const navigate = useNavigate();
  const boardIdIsUuid = isUuidLike(boardId);


const getAuthRedirectTo = () => {
  // In dev BASE_URL is usually "/", in GitHub Pages it's "/pwa-whiteboard/".
  const base = ((globalThis as any).__VITE_BASE_URL as string | undefined) ?? '/';
  const origin = window.location.origin;
  // Send user back to the current board route so Share panel reflects the session immediately.
  return new URL(window.location.pathname + window.location.search + window.location.hash, origin).toString();
};

  const [email, setEmail] = React.useState('');
  const [sessionEmail, setSessionEmail] = React.useState<string | null>(null);
  const [authLoading, setAuthLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const [expiresPresetViewer, setExpiresPresetViewer] = React.useState<ExpiresPreset>('7d');
  const [expiresPresetEditor, setExpiresPresetEditor] = React.useState<ExpiresPreset>('7d');

  const [activeInvites, setActiveInvites] = React.useState<Record<InviteRole, ActiveInvite | null>>({
    viewer: null,
    editor: null,
  });

  const [lastGeneratedUrl, setLastGeneratedUrl] = React.useState<Record<InviteRole, string | null>>({
    viewer: null,
    editor: null,
  });

  const [loadingInvites, setLoadingInvites] = React.useState(false);

  const supabaseReady = isSupabaseConfigured();

  async function migrateBoardIdToUuid(): Promise<void> {
    try {
      setMessage(null);
      const nextId = newUuid();

      const index = readBoardsIndex();
      const meta = index.find((m) => m.id === boardId);
      if (!meta) {
        setMessage('Could not migrate: board metadata not found.');
        return;
      }

      const repo = getWhiteboardRepository();
      const oldState = await repo.loadBoard(boardId);

      const now = new Date().toISOString();
      const nextMeta: WhiteboardMeta = { ...meta, id: nextId, updatedAt: now };

      const base = createEmptyWhiteboardState(nextMeta);
      const nextState: WhiteboardState = {
        ...base,
        objects: oldState?.objects ?? [],
        viewport: oldState?.viewport ?? base.viewport,
        selectedObjectIds: [],
        history: base.history,
      };

      await repo.saveBoard(nextId, nextState);

      const nextIndex = index.filter((m) => m.id !== boardId).concat(nextMeta);
      writeBoardsIndex(nextIndex);
      try {
        window.localStorage.removeItem('pwa-whiteboard.board.' + boardId);
      } catch {
        // ignore
      }

      navigate(`/boards/${nextId}${window.location.search}${window.location.hash}`, { replace: true });
      setMessage('Migrated board to a shareable ID. You can now create invite links.');
    } catch (err) {
      console.error(err);
      setMessage('Could not migrate board id. See console for details.');
    }
  }


  const refreshAuthAndInvites = React.useCallback(async () => {
    if (!supabaseReady) return;
    setMessage(null);
    const client = await getSupabaseClient();
    if (!client) return;

    const { data } = await client.auth.getSession();
    const sess = data?.session ?? null;
    setSessionEmail(sess?.user?.email ?? null);

    if (sess) {
      if (!boardIdIsUuid) {
        setMessage('This board uses a local-only id and cannot be shared yet. Click "Migrate to shareable board" to create a UUID-based board id.');
        return;
      }

      // Ensure board exists in Supabase for this boardId (and is owned by the user)
      const title = (await getBestLocalBoardTitle(boardId, boardName)) ?? boardName ?? 'Untitled board';
      const ensured = await ensureBoardRowInSupabase({
        client,
        boardId,
        ownerUserId: sess.user.id,
        title,
      });
      if (!ensured.ok) {
        setMessage(ensured.message);
        return;
      }

      // Load active invites (token itself is not stored; only hash)
      setLoadingInvites(true);
      const { data: invites, error: invErr } = await client
        .schema('whiteboard')
        .from('board_invites')
        .select('id, role, expires_at, revoked_at, created_at')
        .eq('board_id', boardId)
        .is('revoked_at', null)
        .order('created_at', { ascending: false });
      setLoadingInvites(false);

      if (invErr) {
        setMessage(`Could not load invites: ${invErr.message}`);
        return;
      }

      const next: Record<InviteRole, ActiveInvite | null> = { viewer: null, editor: null };
      for (const row of invites ?? []) {
        if (row.role === 'viewer' && !next.viewer) next.viewer = row;
        if (row.role === 'editor' && !next.editor) next.editor = row;
      }
      setActiveInvites(next);
    }
  }, [boardId, boardName, supabaseReady]);

  React.useEffect(() => {
    refreshAuthAndInvites().catch(() => void 0);
  }, [boardId, boardName, supabaseReady, refreshAuthAndInvites]);

  const signInWithEmail = async () => {
    setMessage(null);
    if (!supabaseReady) {
      setMessage('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }
    if (!email.trim()) {
      setMessage('Enter an email address to sign in.');
      return;
    }
    setAuthLoading(true);
    try {
      const client = await getSupabaseClient();
      if (!client) {
        setMessage('Supabase client not available.');
        return;
      }
      const { error } = await client.auth.signInWithOtp({ email: email.trim() });
      if (error) {
        setMessage(error.message);
        return;
      }
      setMessage('Magic link sent. Check your email to finish signing in.');
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = async () => {
    setMessage(null);
    const client = await getSupabaseClient();
    if (!client) return;
    await client.auth.signOut();
    setSessionEmail(null);
    setActiveInvites({ viewer: null, editor: null });
    setLastGeneratedUrl({ viewer: null, editor: null });
  };

  const rotateInvite = async (role: InviteRole) => {
    setMessage(null);
    const client = await getSupabaseClient();
    if (!client) return;
    const { data } = await client.auth.getSession();
    const sess = data?.session;
    if (!sess) {
      setMessage('Sign in first to create invite links.');
      return;
    }

    const expires_at = computeExpiresAt(role === 'viewer' ? expiresPresetViewer : expiresPresetEditor);

    // Revoke existing active invite for this role
    await client
      .schema('whiteboard')
      .from('board_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('board_id', boardId)
      .eq('role', role)
      .is('revoked_at', null);

    // Generate token and store hash
    const token = generateInviteToken();
    const token_hash = await sha256Hex(token);

    const { data: inserted, error } = await client
      .schema('whiteboard')
      .from('board_invites')
      .insert({
        board_id: boardId,
        role,
        token_hash,
        expires_at,
        created_by_user_id: sess.user.id,
      })
      .select('id, role, expires_at, revoked_at, created_at')
      .single();

    if (error) {
      setMessage(`Could not create invite: ${error.message}`);
      return;
    }

    const url = buildInviteUrl(token);
    setLastGeneratedUrl((prev) => ({ ...prev, [role]: url }));
    setActiveInvites((prev) => ({ ...prev, [role]: inserted as ActiveInvite }));
    setMessage('Invite link created. Copy it now (the token cannot be recovered later).');
  };

  const revokeInvite = async (role: InviteRole) => {
    setMessage(null);
    const current = activeInvites[role];
    if (!current) return;
    const client = await getSupabaseClient();
    if (!client) return;
    const { error } = await client
      .schema('whiteboard')
      .from('board_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', current.id);
    if (error) {
      setMessage(`Could not revoke invite: ${error.message}`);
      return;
    }
    setActiveInvites((prev) => ({ ...prev, [role]: null }));
    setLastGeneratedUrl((prev) => ({ ...prev, [role]: null }));
  };

  const copyLastLink = async (role: InviteRole) => {
    const url = lastGeneratedUrl[role];
    if (!url) {
      setMessage('No invite URL available to copy. Generate/rotate a link first.');
      return;
    }
    const ok = await safeCopy(url);
    setMessage(ok ? 'Copied invite link.' : 'Could not copy automatically. Copy it manually from the text box.');
  };

  return (
    <section className="panel">
      <h3>Share</h3>

      {!supabaseReady && (
        <p className="muted">
          Supabase is not configured. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
        </p>
      )}

      {message && <p className="muted">{message}</p>}

      <div className="field-row">
        <span className="field-label">Account</span>
        <span className="field-value">
          {sessionEmail ? (
            <span>
              Signed in as <strong>{sessionEmail}</strong>{' '}
              <button type="button" className="tool-button" onClick={signOut}>
                Sign out
              </button>

{!boardIdIsUuid && (
  <div style={{ marginTop: 8 }}>
    <div className="muted" style={{ marginBottom: 6 }}>
      This board id is local-only and can’t be shared. Migrate it to a UUID-based id to enable invites.
    </div>
    <button type="button" className="tool-button" onClick={migrateBoardIdToUuid}>
      Migrate to shareable board
    </button>
  </div>
)}

            </span>
          ) : (
            <span className="inline-auth">
              <input
                type="email"
                value={email}
                placeholder="you@example.com"
                onChange={(e) => setEmail(e.target.value)}
                style={{ maxWidth: 220 }}
              />
              <button type="button" className="tool-button" onClick={signInWithEmail} disabled={authLoading || !supabaseReady}>
                {authLoading ? 'Sending…' : 'Send magic link'}
              </button>
            </span>
          )}
        </span>
      </div>

      <div className="share-invites">
        {(['viewer', 'editor'] as InviteRole[]).map((role) => {
          const active = activeInvites[role];
          const preset = role === 'viewer' ? expiresPresetViewer : expiresPresetEditor;
          const setPreset = role === 'viewer' ? setExpiresPresetViewer : setExpiresPresetEditor;
          const lastUrl = lastGeneratedUrl[role];

          return (
            <div key={role} className="share-invite-row">
              <div className="share-invite-header">
                <strong>{role === 'viewer' ? 'Viewer link' : 'Editor link'}</strong>
                <span className="muted">
                  {loadingInvites ? 'Loading…' : active ? 'Active (token not recoverable)' : 'Disabled'}
                </span>
              </div>

              <div className="share-invite-controls">
                <label className="muted">
                  Expires
                  <select value={preset} onChange={(e) => setPreset(e.target.value as ExpiresPreset)} style={{ marginLeft: 8 }}>
                    <option value="7d">7 days</option>
                    <option value="30d">30 days</option>
                    <option value="never">Never</option>
                  </select>
                </label>

                <div className="share-invite-buttons">
                  <button type="button" className="tool-button" onClick={() => rotateInvite(role)} disabled={!sessionEmail}>
                    {active ? 'Rotate' : 'Create'}
                  </button>
                  <button type="button" className="tool-button" onClick={() => revokeInvite(role)} disabled={!sessionEmail || !active}>
                    Revoke
                  </button>
                  <button type="button" className="tool-button" onClick={() => copyLastLink(role)} disabled={!lastUrl}>
                    Copy
                  </button>
                </div>
              </div>

              {lastUrl && (
                <div className="share-invite-url">
                  <input type="text" readOnly value={lastUrl} onFocus={(e) => e.currentTarget.select()} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
