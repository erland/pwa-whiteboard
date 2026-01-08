import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabaseClient, isSupabaseConfigured } from '../../supabase/supabaseClient';
import { ensureBoardRowInSupabase } from '../../supabase/boards';
import { getBestLocalBoardTitle } from '../../domain/boardTitle';
import type { WhiteboardMeta, WhiteboardState } from '../../domain/types';
import { createEmptyWhiteboardState } from '../../domain/whiteboardState';
import { getWhiteboardRepository } from '../../infrastructure/localStorageWhiteboardRepository';
import { buildInviteUrl, generateInviteToken, sha256Hex } from '../../share/inviteTokens';

type InviteRole = 'viewer' | 'editor';

type BoardInvite = {
  id: string;
  role: InviteRole;
  label: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string | null;
};

type SharePanelProps = {
  boardId: string;
  boardName: string;
};

type SupabaseClientNonNull = Exclude<Awaited<ReturnType<typeof getSupabaseClient>>, null>;

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


function getAuthRedirectTo(): string {
  // Send the user back to *this exact URL* after the magic link completes.
  // Works on localhost and GitHub Pages, and avoids import.meta (Jest-safe).
  if (typeof window === 'undefined') return 'http://localhost/';
  return window.location.href;
}

type AuthStep = 'email' | 'otp';

export const SharePanel: React.FC<SharePanelProps> = ({ boardId, boardName }) => {
  const navigate = useNavigate();
  const boardIdIsUuid = isUuidLike(boardId);

  const [email, setEmail] = React.useState('');
  const [authStep, setAuthStep] = React.useState<AuthStep>('email');
  const [otpToken, setOtpToken] = React.useState('');
  const [sessionEmail, setSessionEmail] = React.useState<string | null>(null);
  const [authLoading, setAuthLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const [showAllInvites, setShowAllInvites] = React.useState(false);
  const [invites, setInvites] = React.useState<BoardInvite[]>([]);

  // Step 3: create invites (token shown once; only the hash is stored in Supabase)
  const [createRole, setCreateRole] = React.useState<InviteRole>('viewer');
  const [createLabel, setCreateLabel] = React.useState('');
  const [createExpiryPreset, setCreateExpiryPreset] = React.useState<'7d' | '30d' | 'never'>('30d');
  const [creatingInvite, setCreatingInvite] = React.useState(false);

  const [lastCreatedInviteUrl, setLastCreatedInviteUrl] = React.useState<string | null>(null);
  const [lastCreatedInviteCopied, setLastCreatedInviteCopied] = React.useState(false);

  // Step 4: per-invite management actions
  const [inviteBusyId, setInviteBusyId] = React.useState<string | null>(null);
  const [extendPresetByInviteId, setExtendPresetByInviteId] = React.useState<Record<string, '7d' | '30d' | 'never'>>({});

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
      // If the user signed in (OTP or otherwise), collapse any pending OTP UI.
      setAuthStep('email');
      setOtpToken('');
    }

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

      // Load invites (token itself is not stored; only hash)
      setLoadingInvites(true);
      const nowIso = new Date().toISOString();

      let q = client
        .schema('whiteboard')
        .from('board_invites')
        .select('id, role, label, expires_at, revoked_at, created_at')
        .eq('board_id', boardId);

      if (!showAllInvites) {
        q = q.is('revoked_at', null).or(`expires_at.is.null,expires_at.gt.${nowIso}`);
      }

      const { data: invites, error: invErr } = await q.order('created_at', { ascending: false });
      setLoadingInvites(false);

      if (invErr) {
        setMessage(`Could not load invites: ${invErr.message}`);
        return;
      }

      setInvites((invites ?? []) as BoardInvite[]);
    }
  }, [boardId, boardName, supabaseReady, showAllInvites]);

  React.useEffect(() => {
    refreshAuthAndInvites().catch(() => void 0);
  }, [boardId, boardName, supabaseReady, refreshAuthAndInvites]);

  const sendOtpToEmail = async () => {
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

      // Keep this set as a fallback if a user clicks the link, but the primary flow is OTP.
      // Works on localhost and GitHub Pages, and avoids import.meta (Jest-safe).
      const emailRedirectTo = getAuthRedirectTo();

      const { error } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo },
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setAuthStep('otp');
      setOtpToken('');
      setMessage(
        'Code sent. Enter the one-time code from your email to finish signing in. (If your email only contains a link, update the Supabase email template to include the OTP token.)'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const verifyOtpCode = async () => {
    setMessage(null);
    if (!supabaseReady) {
      setMessage('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }
    if (!email.trim()) {
      setMessage('Enter the same email address you requested the code for.');
      setAuthStep('email');
      return;
    }
    if (!otpToken.trim()) {
      setMessage('Enter the one-time code from your email.');
      return;
    }
    setAuthLoading(true);
    try {
      const client = await getSupabaseClient();
      if (!client) {
        setMessage('Supabase client not available.');
        return;
      }

      const { error } = await client.auth.verifyOtp({
        email: email.trim(),
        token: otpToken.trim(),
        // Supabase email OTP uses type "email".
        type: 'email',
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setAuthStep('email');
      setOtpToken('');
      await refreshAuthAndInvites();
      setMessage('Signed in.');
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
    setInvites([]);

  };

  const computeExpiresAt = (preset: '7d' | '30d' | 'never'): string | null => {
    if (preset === 'never') return null;
    const days = preset === '7d' ? 7 : 30;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  };

  const computeRegeneratedExpiresAt = (inv: BoardInvite): string | null => {
    // Option A: we cannot recover old links. Regenerating creates a new token.
    // Keep the remaining lifetime when possible, otherwise default to 30 days.
    if (!inv.expires_at) return null;
    const expiresMs = Date.parse(inv.expires_at);
    if (Number.isNaN(expiresMs)) return computeExpiresAt('30d');
    const remaining = expiresMs - Date.now();
    if (remaining <= 0) return computeExpiresAt('30d');
    return new Date(Date.now() + remaining).toISOString();
  };

  const getExtendPreset = (inviteId: string): '7d' | '30d' | 'never' => {
    return extendPresetByInviteId[inviteId] ?? '30d';
  };

  const withSignedInSession = async (): Promise<
    | { client: SupabaseClientNonNull; userId: string }
    | null
  > => {
    if (!supabaseReady) {
      setMessage('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return null;
    }
    const client = await getSupabaseClient();
    if (!client) {
      setMessage('Supabase client not available.');
      return null;
    }
    const { data } = await client.auth.getSession();
    const sess = data?.session ?? null;
    if (!sess) {
      setMessage('You must be signed in.');
      return null;
    }
    return { client, userId: sess.user.id };
  };

  const copyText = async (value: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fallback for older browsers / insecure contexts
      try {
        const ta = document.createElement('textarea');
        ta.value = value;
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
  };

  const createInvite = async () => {
    setMessage(null);

    if (!supabaseReady) {
      setMessage('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }
    if (!boardIdIsUuid) {
      setMessage('This board id is local-only. Migrate it to a UUID-based id before creating invite links.');
      return;
    }

    setCreatingInvite(true);
    try {
      const client = await getSupabaseClient();
      if (!client) {
        setMessage('Supabase client not available.');
        return;
      }

      const { data } = await client.auth.getSession();
      const sess = data?.session ?? null;
      if (!sess) {
        setMessage('You must be signed in to create invites.');
        return;
      }

      // Ensure the board exists (owner-only via RLS). Safe to call even if already ensured.
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

      const inviteToken = generateInviteToken();
      const tokenHash = await sha256Hex(inviteToken);
      const expiresAt = computeExpiresAt(createExpiryPreset);
      const label = createLabel.trim() ? createLabel.trim() : null;

      const { error } = await client
        .schema('whiteboard')
        .from('board_invites')
        .insert({
          board_id: boardId,
          role: createRole,
          label,
          token_hash: tokenHash,
          expires_at: expiresAt,
          created_by_user_id: sess.user.id,
        });

      if (error) {
        setMessage(`Could not create invite: ${error.message}`);
        return;
      }

      // Token is shown once. Only the hash is stored in Supabase.
      const url = buildInviteUrl(inviteToken);
      setLastCreatedInviteUrl(url);
      setLastCreatedInviteCopied(false);

      await refreshAuthAndInvites();
      setMessage('Invite created. Copy the one-time link below (it will not be shown again).');
    } finally {
      setCreatingInvite(false);
    }
  };

  const copyLastCreatedInvite = async () => {
    if (!lastCreatedInviteUrl) return;
    const ok = await copyText(lastCreatedInviteUrl);
    if (ok) {
      setLastCreatedInviteCopied(true);
      window.setTimeout(() => setLastCreatedInviteCopied(false), 1200);
    }
  };

  const revokeInvite = async (inviteId: string): Promise<void> => {
    setMessage(null);
    if (inviteBusyId) return;
    const sess = await withSignedInSession();
    if (!sess) return;
    if (!boardIdIsUuid) {
      setMessage('This board id is local-only. Migrate it to a UUID-based id before managing invites.');
      return;
    }

    setInviteBusyId(inviteId);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await sess.client
        .schema('whiteboard')
        .from('board_invites')
        .update({ revoked_at: nowIso })
        .eq('id', inviteId)
        .eq('board_id', boardId);
      if (error) {
        setMessage(`Could not revoke invite: ${error.message}`);
        return;
      }
      await refreshAuthAndInvites();
      setMessage('Invite revoked.');
    } finally {
      setInviteBusyId(null);
    }
  };

  const setInviteExpiry = async (inviteId: string, preset: '7d' | '30d' | 'never'): Promise<void> => {
    setMessage(null);
    if (inviteBusyId) return;
    const sess = await withSignedInSession();
    if (!sess) return;
    if (!boardIdIsUuid) {
      setMessage('This board id is local-only. Migrate it to a UUID-based id before managing invites.');
      return;
    }

    setInviteBusyId(inviteId);
    try {
      const expiresAt = computeExpiresAt(preset);
      const { error } = await sess.client
        .schema('whiteboard')
        .from('board_invites')
        .update({ expires_at: expiresAt })
        .eq('id', inviteId)
        .eq('board_id', boardId);
      if (error) {
        setMessage(`Could not update expiry: ${error.message}`);
        return;
      }
      await refreshAuthAndInvites();
      setMessage('Invite expiry updated.');
    } finally {
      setInviteBusyId(null);
    }
  };

  const regenerateInvite = async (inv: BoardInvite): Promise<void> => {
    setMessage(null);
    if (inviteBusyId) return;
    const sess = await withSignedInSession();
    if (!sess) return;
    if (!boardIdIsUuid) {
      setMessage('This board id is local-only. Migrate it to a UUID-based id before managing invites.');
      return;
    }

    setInviteBusyId(inv.id);
    try {
      // Ensure the board exists (owner-only via RLS). Safe to call even if already ensured.
      const title = (await getBestLocalBoardTitle(boardId, boardName)) ?? boardName ?? 'Untitled board';
      const ensured = await ensureBoardRowInSupabase({
        client: sess.client,
        boardId,
        ownerUserId: sess.userId,
        title,
      });
      if (!ensured.ok) {
        setMessage(ensured.message);
        return;
      }

      // Revoke old invite (if not already revoked) and create a new invite row with a new token.
      const nowIso = new Date().toISOString();
      if (!inv.revoked_at) {
        const { error: revokeErr } = await sess.client
          .schema('whiteboard')
          .from('board_invites')
          .update({ revoked_at: nowIso })
          .eq('id', inv.id)
          .eq('board_id', boardId);
        if (revokeErr) {
          setMessage(`Could not revoke old invite: ${revokeErr.message}`);
          return;
        }
      }

      const inviteToken = generateInviteToken();
      const tokenHash = await sha256Hex(inviteToken);
      const expiresAt = computeRegeneratedExpiresAt(inv);

      const { error: insertErr } = await sess.client
        .schema('whiteboard')
        .from('board_invites')
        .insert({
          board_id: boardId,
          role: inv.role,
          label: inv.label ?? null,
          token_hash: tokenHash,
          expires_at: expiresAt,
          created_by_user_id: sess.userId,
        });

      if (insertErr) {
        setMessage(`Could not regenerate invite: ${insertErr.message}`);
        return;
      }

      const url = buildInviteUrl(inviteToken);
      setLastCreatedInviteUrl(url);
      setLastCreatedInviteCopied(false);

      await refreshAuthAndInvites();
      setMessage('Invite regenerated. Copy the new one-time link below (it will not be shown again).');
    } finally {
      setInviteBusyId(null);
    }
  };

  const formatMaybeDate = (iso: string | null): string => {
    if (!iso) return '—';
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return iso;
    return new Date(ms).toLocaleString();
  };

  const getInviteStatus = (inv: BoardInvite): 'Active' | 'Expired' | 'Revoked' => {
    if (inv.revoked_at) return 'Revoked';
    if (inv.expires_at) {
      const ms = Date.parse(inv.expires_at);
      if (!Number.isNaN(ms) && ms < Date.now()) return 'Expired';
    }
    return 'Active';
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
              {authStep === 'email' ? (
                <>
                  <input
                    type="email"
                    value={email}
                    placeholder="you@example.com"
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ maxWidth: 220 }}
                  />
                  <button type="button" className="tool-button" onClick={sendOtpToEmail} disabled={authLoading || !supabaseReady}>
                    {authLoading ? 'Sending…' : 'Send sign-in code'}
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otpToken}
                    placeholder="One-time code"
                    onChange={(e) => setOtpToken(e.target.value)}
                    style={{ maxWidth: 160 }}
                  />
                  <button type="button" className="tool-button" onClick={verifyOtpCode} disabled={authLoading || !supabaseReady}>
                    {authLoading ? 'Verifying…' : 'Verify code'}
                  </button>
                  <button
                    type="button"
                    className="tool-button"
                    onClick={() => {
                      setAuthStep('email');
                      setOtpToken('');
                      setMessage(null);
                    }}
                    disabled={authLoading}
                  >
                    Back
                  </button>
                  <button type="button" className="tool-button" onClick={sendOtpToEmail} disabled={authLoading || !supabaseReady}>
                    Resend
                  </button>
                </>
              )}
            </span>
          )}
        </span>
      </div>

      <div className="share-invites">
        <div className="share-invite-row">
          <div className="share-invite-header">
            <strong>Invites</strong>
            <span style={{ opacity: 0.8, fontSize: 12 }}>
              {loadingInvites ? 'Loading…' : `${invites.length} ${invites.length === 1 ? 'invite' : 'invites'}`}
            </span>
          </div>

          <div className="share-invite-controls">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={showAllInvites}
                onChange={(e) => setShowAllInvites(e.currentTarget.checked)}
                disabled={!supabaseReady || loadingInvites}
              />
              Show revoked/expired
            </label>

            <div className="share-invite-buttons">
              <button
                type="button"
                className="tool-button"
                onClick={() => refreshAuthAndInvites()}
                disabled={!supabaseReady || loadingInvites}
              >
                Refresh
              </button>
            </div>
          </div>

          {sessionEmail && boardIdIsUuid && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.currentTarget.value as InviteRole)}
                  disabled={creatingInvite || !supabaseReady}
                  title="Role"
                >
                  <option value="viewer">viewer</option>
                  <option value="editor">editor</option>
                </select>

                <input
                  type="text"
                  value={createLabel}
                  onChange={(e) => setCreateLabel(e.currentTarget.value)}
                  placeholder="Label (optional)"
                  style={{ minWidth: 200 }}
                  disabled={creatingInvite || !supabaseReady}
                />

                <select
                  value={createExpiryPreset}
                  onChange={(e) => setCreateExpiryPreset(e.currentTarget.value as '7d' | '30d' | 'never')}
                  disabled={creatingInvite || !supabaseReady}
                  title="Expiry"
                >
                  <option value="7d">Expires in 7 days</option>
                  <option value="30d">Expires in 30 days</option>
                  <option value="never">Never expires</option>
                </select>

                <button
                  type="button"
                  className="tool-button"
                  onClick={createInvite}
                  disabled={creatingInvite || !supabaseReady}
                  title="Create a new invite link"
                >
                  {creatingInvite ? 'Creating…' : 'Create invite'}
                </button>
              </div>

              {lastCreatedInviteUrl && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>
                    One-time link (only shown once — copy it now):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <input type="text" readOnly value={lastCreatedInviteUrl} style={{ flex: '1 1 420px', minWidth: 260 }} />
                    <button type="button" className="tool-button" onClick={copyLastCreatedInvite}>
                      {lastCreatedInviteCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <p style={{ marginTop: 8, opacity: 0.75, fontSize: 12 }}>
            Invite links are not stored (only a token hash). If you lose a link, use “Regenerate link” to create a new one.
          </p>
        </div>

        {invites.length === 0 && !loadingInvites && (
          <div className="share-invite-row">
            <div className="share-invite-header">
              <strong>No invites yet</strong>
            </div>
            <div style={{ opacity: 0.8, fontSize: 12 }}>
              Use the form above to create viewer/editor invites.
            </div>
          </div>
        )}

        {invites.map((inv) => {
          const status = getInviteStatus(inv);
          const canManage = !!sessionEmail && boardIdIsUuid;
          const busy = inviteBusyId === inv.id;
          const extendPreset = getExtendPreset(inv.id);
          return (
            <div key={inv.id} className="share-invite-row">
              <div className="share-invite-header">
                <strong>{inv.label?.trim() ? inv.label : '(Unnamed invite)'}</strong>
                <span style={{ opacity: 0.8, fontSize: 12 }}>
                  {inv.role} • {status}
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, opacity: 0.85 }}>
                <span>Created: {formatMaybeDate(inv.created_at)}</span>
                <span>Expires: {inv.expires_at ? formatMaybeDate(inv.expires_at) : 'Never'}</span>
                {inv.revoked_at && <span>Revoked: {formatMaybeDate(inv.revoked_at)}</span>}
              </div>

              {canManage && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  {!inv.revoked_at && (
                    <>
                      <button
                        type="button"
                        className="tool-button"
                        onClick={() => revokeInvite(inv.id)}
                        disabled={busy || !supabaseReady}
                        title="Revoke this invite"
                      >
                        {busy ? 'Working…' : 'Revoke'}
                      </button>

                      <select
                        value={extendPreset}
                        onChange={(e) =>
                          setExtendPresetByInviteId((prev) => ({
                            ...prev,
                            [inv.id]: e.currentTarget.value as '7d' | '30d' | 'never',
                          }))
                        }
                        disabled={busy || !supabaseReady}
                        title="Set a new expiry"
                      >
                        <option value="7d">Expires in 7 days</option>
                        <option value="30d">Expires in 30 days</option>
                        <option value="never">Never expires</option>
                      </select>

                      <button
                        type="button"
                        className="tool-button"
                        onClick={() => setInviteExpiry(inv.id, extendPreset)}
                        disabled={busy || !supabaseReady}
                        title="Update expiry (can reactivate an expired invite)"
                      >
                        {busy ? 'Working…' : 'Set expiry'}
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="tool-button"
                    onClick={() => regenerateInvite(inv)}
                    disabled={busy || !supabaseReady}
                    title="Create a new one-time link (old link will stop working)"
                  >
                    {busy ? 'Working…' : 'Regenerate link'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
