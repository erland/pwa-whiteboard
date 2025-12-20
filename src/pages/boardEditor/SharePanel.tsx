import React from 'react';
import { getSupabaseClient, isSupabaseConfigured } from '../../supabase/getSupabaseClient';
import { buildInviteUrl, generateInviteToken, sha256Hex } from '../../share/inviteTokens';

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

  const refreshAuthAndInvites = React.useCallback(async () => {
    if (!supabaseReady) return;
    setMessage(null);
    const client = await getSupabaseClient();
    if (!client) return;

    const { data } = await client.auth.getSession();
    const sess = data?.session ?? null;
    setSessionEmail(sess?.user?.email ?? null);

    if (sess) {
      // Ensure board exists in Supabase for this boardId (and is owned by the user)
      const { data: existing, error: selErr } = await client
        .schema('whiteboard')
        .from('boards')
        .select('id, owner_user_id')
        .eq('id', boardId)
        .maybeSingle();

      if (!selErr && existing && existing.owner_user_id !== sess.user.id) {
        setMessage('You are signed in, but you are not the owner of this board in Supabase.');
        return;
      }

      if (!existing) {
        const { error: insErr } = await client
          .schema('whiteboard')
          .from('boards')
          .insert({
            id: boardId,
            owner_user_id: sess.user.id,
            title: boardName || 'Board',
          });
        if (insErr) {
          setMessage(`Could not create board in Supabase: ${insErr.message}`);
          return;
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

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
