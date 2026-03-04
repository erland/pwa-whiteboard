import React from 'react';
import { useAuth } from '../../auth/AuthContext';

type SharePanelProps = {
  boardId: string;
  boardName?: string;
  hideTitle?: boolean;
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

export const SharePanel: React.FC<SharePanelProps> = ({ boardId, boardName, hideTitle }) => {
  const { configured, authenticated, displayName, login, logout } = useAuth();

  const inviteToken = getInviteTokenFromUrl();
  const inviteLink = React.useMemo(() => {
    if (!inviteToken) return null;
    const url = new URL(getCurrentUrl());
    url.searchParams.set('invite', inviteToken);
    return url.toString();
  }, [inviteToken]);

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

      <div className="share-section">
        <div className="share-label">Invite links</div>

        {inviteLink ? (
          <>
            <div className="share-help">You opened this board using an invite link. You can copy it again here.</div>
            <input type="text" readOnly value={inviteLink} aria-label="Current invite link" />
          </>
        ) : (
          <div className="share-help">
            Invite creation will be wired to the new server API in a later step. (Board: <code>{boardId}</code>
            {boardName ? ` — ${boardName}` : ''})
          </div>
        )}
      </div>
    </div>
  );
};
