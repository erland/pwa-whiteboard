import React from 'react';
import { useAuth } from '../../auth/AuthContext';
import { acceptInvite, createBoardInvite, validateInvite, type InvitePermission } from '../../api/invitesApi';
import type { ServerFeatureFlags } from '../../domain/serverFeatures';
import { CapabilitySummary } from './CapabilitySummary';

type SharePanelProps = {
  boardId: string;
  boardName?: string;
  hideTitle?: boolean;
  isReadOnly?: boolean;
  features?: ServerFeatureFlags;
  isCapabilitiesLoading?: boolean;
  capabilitiesError?: string | null;
};

function getCurrentUrl(): string {
  if (typeof window === 'undefined') return '';
  return window.location.href;
}

function getInviteTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const q = url.searchParams.get('invite');
  if (q) return q.trim();

  // Allow #invite=TOKEN (useful when query params are hard to share)
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const m = /(?:^|&)invite=([^&]+)/.exec(hash);
  if (m?.[1]) return decodeURIComponent(m[1]).trim();

  return null;
}

export const SharePanel: React.FC<SharePanelProps> = ({
  boardId,
  boardName,
  hideTitle,
  isReadOnly = false,
  features,
  isCapabilitiesLoading = false,
  capabilitiesError = null,
}) => {
  const { configured, authenticated, displayName, login, logout } = useAuth();

  const [createRole, setCreateRole] = React.useState<'viewer' | 'editor'>('viewer');
  const [creating, setCreating] = React.useState(false);
  const [lastCreatedInviteUrl, setLastCreatedInviteUrl] = React.useState<string | null>(null);
  const [lastCreatedInviteCopied, setLastCreatedInviteCopied] = React.useState(false);
  const [inviteStatus, setInviteStatus] = React.useState<
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'validated'; valid: boolean; permission?: InvitePermission; expiresAt?: string; boardId?: string }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });
  const [accepting, setAccepting] = React.useState(false);
  const [accepted, setAccepted] = React.useState(false);

  const inviteToken = getInviteTokenFromUrl();
  const inviteLink = React.useMemo(() => {
    if (!inviteToken) return null;
    const url = new URL(getCurrentUrl());
    url.searchParams.set('invite', inviteToken);
    return url.toString();
  }, [inviteToken]);



  const effectiveFeatures = React.useMemo<ServerFeatureFlags>(
    () =>
      features ?? {
        apiVersion: '',
        wsProtocolVersion: '',
        capabilities: [],
        supportsComments: false,
        supportsVoting: false,
        supportsPublications: false,
        supportsSharedTimer: false,
        supportsReactions: false,
      },
    [features]
  );

  const buildInviteUrl = React.useCallback((token: string) => {
    const url = new URL(getCurrentUrl());
    url.searchParams.set('invite', token);
    url.hash = '';
    return url.toString();
  }, []);

  // Validate invite token (informational) when the user is authenticated.
  React.useEffect(() => {
    let cancelled = false;
    if (!inviteToken || !authenticated) {
      setInviteStatus({ kind: 'idle' });
      return;
    }
    setInviteStatus({ kind: 'loading' });
    validateInvite(inviteToken)
      .then((res) => {
        if (cancelled) return;
        setInviteStatus({
          kind: 'validated',
          valid: Boolean(res.valid),
          permission: res.permission,
          expiresAt: res.expiresAt,
          boardId: res.boardId,
        });
      })
      .catch((e: any) => {
        if (cancelled) return;
        setInviteStatus({ kind: 'error', message: String(e?.message ?? e) });
      });
    return () => {
      cancelled = true;
    };
  }, [inviteToken, authenticated]);

  const handleCreateInvite = async () => {
    if (!authenticated || isReadOnly) return;
    setCreating(true);
    setLastCreatedInviteCopied(false);
    try {
      const permission: InvitePermission = createRole === 'editor' ? 'editor' : 'viewer';
      const created = await createBoardInvite({ boardId, permission });
      setLastCreatedInviteUrl(buildInviteUrl(created.token));
    } catch (e) {
      // Surface as a simple alert for now; we can improve UX later.
      // eslint-disable-next-line no-alert
      alert(`Failed to create invite: ${String((e as any)?.message ?? e)}`);
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLastCreatedInvite = async () => {
    if (!lastCreatedInviteUrl) return;
    try {
      await navigator.clipboard.writeText(lastCreatedInviteUrl);
      setLastCreatedInviteCopied(true);
      window.setTimeout(() => setLastCreatedInviteCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  const handleAcceptInvite = async () => {
    if (!inviteToken || !authenticated) return;
    setAccepting(true);
    try {
      await acceptInvite(inviteToken);
      setAccepted(true);

      // Remove token from the URL to avoid leaking it.
      try {
        const url = new URL(getCurrentUrl());
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', url.toString());
      } catch {
        // ignore
      }
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(`Failed to accept invite: ${String((e as any)?.message ?? e)}`);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="share-panel">
      {!hideTitle && <h3>Share</h3>}

      <div className="share-section">
        <div className="share-row">
          <div>
            <div className="share-label">Authentication</div>
            {!configured ? (
              <div className="share-help">
                OIDC is not configured. Set <code>VITE_OIDC_ISSUER</code> and <code>VITE_OIDC_CLIENT_ID</code>.
              </div>
            ) : authenticated ? (
              <div className="share-help">Signed in{displayName ? ` as ${displayName}` : ''}.</div>
            ) : (
              <div className="share-help">You are signed out.</div>
            )}
          </div>

          {configured && (
            <div className="share-actions">
              {!authenticated ? (
                <button type="button" className="tool-button" onClick={() => login().catch(() => void 0)}>
                  Sign in
                </button>
              ) : (
                <button type="button" className="tool-button" onClick={() => logout().catch(() => void 0)}>
                  Sign out
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <CapabilitySummary
        hideTitle={hideTitle}
        features={effectiveFeatures}
        isLoading={isCapabilitiesLoading}
        error={capabilitiesError}
      />

      <div className="share-section">
        <div className="share-label">Invite links</div>

        {inviteLink ? (
          <>
            <div className="share-help">You opened this board using an invite link.</div>
            <input type="text" readOnly value={inviteLink} aria-label="Current invite link" />

            {!authenticated ? (
              <div className="share-help" style={{ marginTop: 8 }}>
                Sign in to validate and accept this invite.
              </div>
            ) : (
              <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                {accepted ? (
                  <div className="share-help">✅ Invite accepted. You can now access this board from your board list.</div>
                ) : (
                  <button type="button" className="tool-button" onClick={handleAcceptInvite} disabled={accepting}>
                    {accepting ? 'Accepting…' : 'Accept invite'}
                  </button>
                )}

                {inviteStatus.kind === 'loading' && <div className="share-help">Validating invite…</div>}
                {inviteStatus.kind === 'validated' && (
                  <div className="share-help">
                    {inviteStatus.valid ? (
                      <>
                        Valid invite{inviteStatus.permission ? ` (${inviteStatus.permission})` : ''}
                        {inviteStatus.expiresAt ? ` — expires ${new Date(inviteStatus.expiresAt).toLocaleString()}` : ''}.
                      </>
                    ) : (
                      <>This invite is not valid (expired or revoked).</>
                    )}
                  </div>
                )}
                {inviteStatus.kind === 'error' && (
                  <div className="share-help">Could not validate invite: {inviteStatus.message}</div>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <div className="share-help">
              Create an invite link for this board. (Board: <code>{boardId}</code>
              {boardName ? ` — ${boardName}` : ''})
            </div>
            {effectiveFeatures.supportsPublications ? (
              <div className="share-help">
                This server also advertises publication-link support, so the Share dialog can expand with public review links in a later step.
              </div>
            ) : (
              <div className="share-help">
                This server has not advertised publication-link support, so future public sharing UI stays hidden/disabled.
              </div>
            )}

            {!authenticated ? (
              <div className="share-help">Sign in to create invites.</div>
            ) : (
              <>
                <label style={{ display: 'grid', gap: 6, maxWidth: 260 }}>
                  <span className="form-help">Permission</span>
                  <select value={createRole} onChange={(e) => setCreateRole(e.currentTarget.value as any)} disabled={creating}>
                    <option value="viewer">viewer</option>
                    <option value="editor">editor</option>
                  </select>
                </label>

                <button type="button" className="tool-button" onClick={handleCreateInvite} disabled={creating}>
                  {creating ? 'Creating…' : 'Create invite link'}
                </button>

                {lastCreatedInviteUrl && (
                  <div style={{ marginTop: 6, display: 'grid', gap: 8 }}>
                    <div style={{ opacity: 0.8, fontSize: 12 }}>
                      One-time link (only shown once — copy it now):
                    </div>
                    <input type="text" readOnly value={lastCreatedInviteUrl} />
                    <button type="button" className="tool-button" onClick={handleCopyLastCreatedInvite}>
                      {lastCreatedInviteCopied ? 'Copied!' : 'Copy link'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
