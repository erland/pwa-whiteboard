import React from 'react';
import { useAuth } from '../../auth/AuthContext';
import {
  acceptInvite,
  createBoardInvite,
  listBoardInvites,
  revokeBoardInvite,
  validateInvite,
  type BoardInvite,
  type InvitePermission,
} from '../../api/invitesApi';
import { createPublicationsApi, type BoardPublication, type BoardPublicationTargetType } from '../../api/publicationsApi';
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

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const time = Date.parse(value);
  if (Number.isNaN(time)) return value;
  return new Date(time).toLocaleString();
}

function toDateTimeLocalValue(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDateTimeLocalValue(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function getPublicationTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const q = url.searchParams.get('publication');
  if (q) return q.trim();
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const m = /(?:^|&)publication=([^&]+)/.exec(hash);
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
  const [inviteExpiresAt, setInviteExpiresAt] = React.useState('');
  const [inviteMaxUses, setInviteMaxUses] = React.useState('');
  const [lastCreatedInviteUrl, setLastCreatedInviteUrl] = React.useState<string | null>(null);
  const [lastCreatedInviteCopied, setLastCreatedInviteCopied] = React.useState(false);
  const [managedInvites, setManagedInvites] = React.useState<BoardInvite[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = React.useState(false);
  const [isRefreshingInviteList, setIsRefreshingInviteList] = React.useState(false);
  const [inviteAdminError, setInviteAdminError] = React.useState<string | null>(null);
  const [activeInviteId, setActiveInviteId] = React.useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = React.useState<
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'validated'; valid: boolean; permission?: InvitePermission; expiresAt?: string; boardId?: string }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });
  const [accepting, setAccepting] = React.useState(false);
  const [accepted, setAccepted] = React.useState(false);

  const [publications, setPublications] = React.useState<BoardPublication[]>([]);
  const [isLoadingPublications, setIsLoadingPublications] = React.useState(false);
  const [publicationError, setPublicationError] = React.useState<string | null>(null);
  const [publicationTargetType, setPublicationTargetType] = React.useState<BoardPublicationTargetType>('board');
  const [publicationSnapshotVersion, setPublicationSnapshotVersion] = React.useState('');
  const [publicationAllowComments, setPublicationAllowComments] = React.useState(false);
  const [publicationExpiresAt, setPublicationExpiresAt] = React.useState('');
  const [isCreatingPublication, setIsCreatingPublication] = React.useState(false);
  const [isRefreshingPublicationList, setIsRefreshingPublicationList] = React.useState(false);
  const [activePublicationId, setActivePublicationId] = React.useState<string | null>(null);
  const [lastCreatedPublicationUrl, setLastCreatedPublicationUrl] = React.useState<string | null>(null);
  const [publicationUrlsById, setPublicationUrlsById] = React.useState<Record<string, string>>({});
  const [lastCreatedPublicationCopied, setLastCreatedPublicationCopied] = React.useState(false);
  const [lastResolvedPublicationId, setLastResolvedPublicationId] = React.useState<string | null>(null);

  const inviteToken = getInviteTokenFromUrl();
  const publicationToken = getPublicationTokenFromUrl();
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

  const buildPublicationUrl = React.useCallback((token: string) => {
    const url = new URL(getCurrentUrl());
    url.searchParams.set('publication', token);
    url.searchParams.delete('invite');
    url.hash = '';
    return url.toString();
  }, []);

  const loadInvites = React.useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!authenticated || isReadOnly) {
      setManagedInvites([]);
      setInviteAdminError(null);
      return;
    }

    if (mode === 'initial') setIsLoadingInvites(true);
    else setIsRefreshingInviteList(true);

    try {
      const listed = await listBoardInvites(boardId);
      setManagedInvites(listed);
      setInviteAdminError(null);
    } catch (e: any) {
      setInviteAdminError(String(e?.message ?? e));
    } finally {
      if (mode === 'initial') setIsLoadingInvites(false);
      else setIsRefreshingInviteList(false);
    }
  }, [authenticated, boardId, isReadOnly]);

  const loadPublications = React.useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!effectiveFeatures.supportsPublications || !authenticated || isReadOnly) {
      setPublications([]);
      setPublicationError(null);
      return;
    }

    if (mode === 'initial') setIsLoadingPublications(true);
    else setIsRefreshingPublicationList(true);

    try {
      const listed = await createPublicationsApi().list(boardId);
      setPublications(listed);
      setPublicationError(null);
    } catch (e: any) {
      setPublicationError(String(e?.message ?? e));
    } finally {
      if (mode === 'initial') setIsLoadingPublications(false);
      else setIsRefreshingPublicationList(false);
    }
  }, [authenticated, boardId, effectiveFeatures.supportsPublications, isReadOnly]);

  React.useEffect(() => {
    let cancelled = false;
    if (!publicationToken || !effectiveFeatures.supportsPublications) {
      setLastResolvedPublicationId(null);
      return;
    }

    createPublicationsApi()
      .resolve(publicationToken)
      .then((publication) => {
        if (cancelled) return;
        setLastResolvedPublicationId(publication.id);
      })
      .catch(() => {
        if (cancelled) return;
        setLastResolvedPublicationId(null);
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveFeatures.supportsPublications, publicationToken]);

  React.useEffect(() => {
    void loadPublications('initial');
  }, [loadPublications]);

  React.useEffect(() => {
    void loadInvites('initial');
  }, [loadInvites]);

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
    setInviteAdminError(null);
    try {
      const permission: InvitePermission = createRole === 'editor' ? 'editor' : 'viewer';
      const parsedMaxUses = inviteMaxUses.trim() ? Number.parseInt(inviteMaxUses.trim(), 10) : undefined;
      if (parsedMaxUses != null && (!Number.isFinite(parsedMaxUses) || parsedMaxUses <= 0)) {
        throw new Error('Enter a valid maximum use count.');
      }
      const created = await createBoardInvite({
        boardId,
        permission,
        expiresAt: fromDateTimeLocalValue(inviteExpiresAt),
        maxUses: parsedMaxUses,
      });
      setLastCreatedInviteUrl(buildInviteUrl(created.token));
      setManagedInvites((current) => [created, ...current.filter((entry) => entry.id !== created.id)]);
      setInviteExpiresAt('');
      setInviteMaxUses('');
    } catch (e) {
      setInviteAdminError(String((e as any)?.message ?? e));
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

  const handleRevokeInvite = async (inviteId: string) => {
    if (!authenticated || isReadOnly) return;
    setActiveInviteId(inviteId);
    setInviteAdminError(null);
    try {
      await revokeBoardInvite(boardId, inviteId);
      await loadInvites('refresh');
    } catch (e: any) {
      setInviteAdminError(String(e?.message ?? e));
    } finally {
      setActiveInviteId(null);
    }
  };

  const handleAcceptInvite = async () => {
    if (!inviteToken || !authenticated) return;
    setAccepting(true);
    try {
      await acceptInvite(inviteToken);
      setAccepted(true);

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

  const handleCreatePublication = async () => {
    if (!authenticated || isReadOnly || !effectiveFeatures.supportsPublications) return;
    setIsCreatingPublication(true);
    setLastCreatedPublicationCopied(false);
    setPublicationError(null);
    try {
      const parsedSnapshotVersion = publicationTargetType === 'snapshot'
        ? Number.parseInt(publicationSnapshotVersion.trim(), 10)
        : undefined;
      if (
        publicationTargetType === 'snapshot'
        && (parsedSnapshotVersion == null || !Number.isFinite(parsedSnapshotVersion) || parsedSnapshotVersion <= 0)
      ) {
        throw new Error('Enter a valid snapshot version for snapshot publications.');
      }
      const created = await createPublicationsApi().create(boardId, {
        targetType: publicationTargetType,
        snapshotVersion: publicationTargetType === 'snapshot' ? parsedSnapshotVersion : undefined,
        allowComments: publicationAllowComments,
        expiresAt: fromDateTimeLocalValue(publicationExpiresAt),
      });
      const createdUrl = buildPublicationUrl(created.token);
      setLastCreatedPublicationUrl(createdUrl);
      setPublicationUrlsById((current) => ({ ...current, [created.publication.id]: createdUrl }));
      setPublications((current) => [created.publication, ...current.filter((entry) => entry.id !== created.publication.id)]);
      setPublicationTargetType('board');
      setPublicationSnapshotVersion('');
      setPublicationAllowComments(false);
      setPublicationExpiresAt('');
    } catch (e: any) {
      setPublicationError(String(e?.message ?? e));
    } finally {
      setIsCreatingPublication(false);
    }
  };

  const handleCopyPublicationLink = async (value: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setLastCreatedPublicationCopied(true);
      window.setTimeout(() => setLastCreatedPublicationCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  const handleRotatePublicationToken = async (publicationId: string) => {
    if (!authenticated || isReadOnly) return;
    setActivePublicationId(publicationId);
    setPublicationError(null);
    try {
      const rotated = await createPublicationsApi().rotateToken(boardId, publicationId);
      const rotatedUrl = buildPublicationUrl(rotated.token);
      setLastCreatedPublicationUrl(rotatedUrl);
      setPublicationUrlsById((current) => ({ ...current, [publicationId]: rotatedUrl }));
      setPublications((current) => current.map((entry) => (entry.id === publicationId ? rotated.publication : entry)));
    } catch (e: any) {
      setPublicationError(String(e?.message ?? e));
    } finally {
      setActivePublicationId(null);
    }
  };

  const handleRevokePublication = async (publicationId: string) => {
    if (!authenticated || isReadOnly) return;
    setActivePublicationId(publicationId);
    setPublicationError(null);
    try {
      await createPublicationsApi().revoke(boardId, publicationId);
      setPublicationUrlsById((current) => { const next = { ...current }; delete next[publicationId]; return next; });
      await loadPublications('refresh');
    } catch (e: any) {
      setPublicationError(String(e?.message ?? e));
    } finally {
      setActivePublicationId(null);
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

      {effectiveFeatures.supportsPublications && (
        <div className="share-section">
          <div className="share-publication-header">
            <div>
              <div className="share-label">Publication links</div>
              <div className="share-help">
                Create read-only links for board-wide review or pin sharing to a specific snapshot version.
              </div>
            </div>
            {authenticated && !isReadOnly && (
              <button
                type="button"
                className="tool-button"
                onClick={() => void loadPublications('refresh')}
                disabled={isRefreshingPublicationList || isLoadingPublications}
              >
                {isRefreshingPublicationList ? 'Refreshing…' : 'Refresh list'}
              </button>
            )}
          </div>

          {publicationToken && (
            <div className="share-help">
              You opened this board using a publication link{lastResolvedPublicationId ? ` (${lastResolvedPublicationId})` : ''}.
            </div>
          )}

          {!authenticated ? (
            <div className="share-help">Sign in to create, rotate, and revoke publication links.</div>
          ) : isReadOnly ? (
            <div className="share-help">Publication management is unavailable while the board is open read-only.</div>
          ) : (
            <div className="share-publication-grid">
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="form-help">Target</span>
                <select
                  aria-label="Publication target"
                  value={publicationTargetType}
                  onChange={(e) => setPublicationTargetType(e.currentTarget.value as BoardPublicationTargetType)}
                  disabled={isCreatingPublication}
                >
                  <option value="board">Live board</option>
                  <option value="snapshot">Specific snapshot</option>
                </select>
              </label>

              {publicationTargetType === 'snapshot' && (
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="form-help">Snapshot version</span>
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    aria-label="Snapshot version"
                    value={publicationSnapshotVersion}
                    onChange={(e) => setPublicationSnapshotVersion(e.currentTarget.value)}
                    placeholder="e.g. 12"
                    disabled={isCreatingPublication}
                  />
                </label>
              )}

              <label style={{ display: 'grid', gap: 6 }}>
                <span className="form-help">Expires at (optional)</span>
                <input
                  type="datetime-local"
                  aria-label="Publication expiry"
                  value={publicationExpiresAt}
                  onChange={(e) => setPublicationExpiresAt(e.currentTarget.value)}
                  disabled={isCreatingPublication}
                />
              </label>

              <label className="share-checkbox-row">
                <input
                  type="checkbox"
                  checked={publicationAllowComments}
                  onChange={(e) => setPublicationAllowComments(e.currentTarget.checked)}
                  disabled={isCreatingPublication}
                />
                <span>Allow comments for published readers</span>
              </label>

              <button type="button" className="tool-button" onClick={handleCreatePublication} disabled={isCreatingPublication}>
                {isCreatingPublication ? 'Creating…' : 'Create publication link'}
              </button>
            </div>
          )}

          {publicationError && <div className="share-help">Publication error: {publicationError}</div>}

          {lastCreatedPublicationUrl && (
            <div className="share-created-link-box">
              <div className="share-help">Latest publication link (copy it now):</div>
              <input type="text" readOnly value={lastCreatedPublicationUrl} aria-label="Latest publication link" />
              <button type="button" className="tool-button" onClick={() => void handleCopyPublicationLink(lastCreatedPublicationUrl)}>
                {lastCreatedPublicationCopied ? 'Copied!' : 'Copy publication link'}
              </button>
            </div>
          )}

          {authenticated && !isReadOnly && (
            <div className="share-publication-list">
              {isLoadingPublications ? (
                <div className="share-help">Loading publication links…</div>
              ) : publications.length === 0 ? (
                <div className="share-help">No publication links created yet.</div>
              ) : (
                publications.map((publication) => {
                  const isBusy = activePublicationId === publication.id;
                  const shareUrl = publicationUrlsById[publication.id]
                    ?? (lastResolvedPublicationId === publication.id && publicationToken ? buildPublicationUrl(publicationToken) : null);
                  return (
                    <div key={publication.id} className="share-publication-card" data-state={publication.state}>
                      <div className="comment-card-header">
                        <div>
                          <strong>{publication.targetType === 'snapshot' ? `Snapshot v${publication.snapshotVersion ?? '—'}` : 'Live board'}</strong>
                          <div className="share-help">
                            State: {publication.state} · Comments: {publication.allowComments ? 'allowed' : 'read-only'}
                          </div>
                        </div>
                        <span className="capability-chip" data-enabled={publication.state === 'active' ? 'true' : 'false'}>
                          {publication.state}
                        </span>
                      </div>

                      <div className="share-publication-meta">
                        <span>Created {formatDateTime(publication.createdAt)}</span>
                        <span>Updated {formatDateTime(publication.updatedAt)}</span>
                        <span>Expires {formatDateTime(publication.expiresAt)}</span>
                      </div>

                      {shareUrl && (
                        <input type="text" readOnly value={shareUrl} aria-label={`Publication link ${publication.id}`} />
                      )}

                      <div className="comment-card-actions">
                        <button type="button" className="tool-button" onClick={() => void handleRotatePublicationToken(publication.id)} disabled={isBusy}>
                          {isBusy ? 'Working…' : 'Rotate token'}
                        </button>
                        <button
                          type="button"
                          className="tool-button"
                          onClick={() => void handleRevokePublication(publication.id)}
                          disabled={isBusy || publication.state !== 'active'}
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      <div className="share-section">
        <div className="share-publication-header">
          <div>
            <div className="share-label">Invite links</div>
            <div className="share-help">
              Create member invite links, review active invites, and revoke links that should no longer grant access.
            </div>
          </div>
          {authenticated && !isReadOnly && (
            <button
              type="button"
              className="tool-button"
              onClick={() => void loadInvites('refresh')}
              disabled={isRefreshingInviteList || isLoadingInvites}
            >
              {isRefreshingInviteList ? 'Refreshing…' : 'Refresh list'}
            </button>
          )}
        </div>

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
        ) : null}

        {!authenticated ? (
          <div className="share-help">Sign in to create and manage invite links.</div>
        ) : isReadOnly ? (
          <div className="share-help">Invite management is unavailable while the board is open read-only.</div>
        ) : (
          <>
            <div style={{ display: 'grid', gap: 10 }}>
              <div className="share-help">
                Member invite links are only shown once at creation time. Existing invites can still be reviewed and revoked below.
                (Board: <code>{boardId}</code>
                {boardName ? ` — ${boardName}` : ''})
              </div>

              <div className="share-publication-grid">
                <label style={{ display: 'grid', gap: 6, maxWidth: 260 }}>
                  <span className="form-help">Permission</span>
                  <select value={createRole} onChange={(e) => setCreateRole(e.currentTarget.value as any)} disabled={creating}>
                    <option value="viewer">viewer</option>
                    <option value="editor">editor</option>
                  </select>
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="form-help">Expires at (optional)</span>
                  <input
                    type="datetime-local"
                    aria-label="Invite expiry"
                    value={inviteExpiresAt}
                    onChange={(e) => setInviteExpiresAt(e.currentTarget.value)}
                    disabled={creating}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6, maxWidth: 220 }}>
                  <span className="form-help">Max uses (optional)</span>
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    aria-label="Invite max uses"
                    value={inviteMaxUses}
                    onChange={(e) => setInviteMaxUses(e.currentTarget.value)}
                    placeholder="Unlimited"
                    disabled={creating}
                  />
                </label>

                <button type="button" className="tool-button" onClick={handleCreateInvite} disabled={creating}>
                  {creating ? 'Creating…' : 'Create invite link'}
                </button>
              </div>

              {inviteAdminError && <div className="share-help">Invite error: {inviteAdminError}</div>}

              {lastCreatedInviteUrl && (
                <div className="share-created-link-box">
                  <div className="share-help">Latest invite link (copy it now):</div>
                  <input type="text" readOnly value={lastCreatedInviteUrl} aria-label="Latest invite link" />
                  <button type="button" className="tool-button" onClick={handleCopyLastCreatedInvite}>
                    {lastCreatedInviteCopied ? 'Copied!' : 'Copy link'}
                  </button>
                </div>
              )}
            </div>

            <div className="share-publication-list">
              {isLoadingInvites ? (
                <div className="share-help">Loading invites…</div>
              ) : managedInvites.length === 0 ? (
                <div className="share-help">No invite links created yet.</div>
              ) : (
                managedInvites.map((invite) => {
                  const isBusy = activeInviteId === invite.id;
                  const inviteState = invite.revokedAt
                    ? 'revoked'
                    : invite.expiresAt && Date.parse(invite.expiresAt) <= Date.now()
                      ? 'expired'
                      : 'active';
                  const usageLabel = invite.maxUses == null
                    ? `${invite.uses} use${invite.uses === 1 ? '' : 's'}`
                    : `${invite.uses}/${invite.maxUses} uses`;
                  return (
                    <div key={invite.id} className="share-publication-card" data-state={inviteState}>
                      <div className="comment-card-header">
                        <div>
                          <strong>{invite.permission === 'editor' ? 'Editor invite' : 'Viewer invite'}</strong>
                          <div className="share-help">
                            State: {inviteState} · {usageLabel}
                          </div>
                        </div>
                        <span className="capability-chip" data-enabled={inviteState === 'active' ? 'true' : 'false'}>
                          {inviteState}
                        </span>
                      </div>

                      <div className="share-publication-meta">
                        <span>Created {formatDateTime(invite.createdAt)}</span>
                        <span>Expires {formatDateTime(invite.expiresAt)}</span>
                        <span>Revoked {formatDateTime(invite.revokedAt)}</span>
                      </div>

                      <div className="comment-card-actions">
                        <button
                          type="button"
                          className="tool-button"
                          onClick={() => void handleRevokeInvite(invite.id)}
                          disabled={isBusy || inviteState !== 'active'}
                        >
                          {isBusy ? 'Working…' : 'Revoke'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
