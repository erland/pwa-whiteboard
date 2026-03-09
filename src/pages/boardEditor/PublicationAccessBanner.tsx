import React from 'react';
import type { PublicationSession } from '../hooks/publicationSession';

type PublicationAccessBannerProps = {
  publicationSession: PublicationSession;
  commentsFeatureEnabled: boolean;
  commentsAuthenticated: boolean;
  onOpenComments?: () => void;
  onSignIn?: () => void;
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'No expiry';
  const time = Date.parse(value);
  if (Number.isNaN(time)) return value;
  return new Date(time).toLocaleString();
}

export const PublicationAccessBanner: React.FC<PublicationAccessBannerProps> = ({
  publicationSession,
  commentsFeatureEnabled,
  commentsAuthenticated,
  onOpenComments,
  onSignIn,
}) => {
  const targetLabel = publicationSession.targetType === 'snapshot'
    ? `Snapshot v${publicationSession.snapshotVersion ?? '—'}`
    : 'Live board';

  const commentsSummary = !commentsFeatureEnabled
    ? 'Comments are unavailable on this server.'
    : publicationSession.allowComments
      ? commentsAuthenticated
        ? 'Comments are available for board members.'
        : 'Comments are available after sign-in.'
      : 'This publication is view-only. Comments are disabled for this link.';

  return (
    <section className="publication-access-banner" role="status" aria-live="polite">
      <div className="publication-access-banner__header">
        <div>
          <strong>Published board</strong>
          <div className="publication-access-banner__subtitle">
            Read-only access via public link
          </div>
        </div>
        <span className="publication-access-banner__mode">Publication</span>
      </div>

      <div className="publication-access-banner__meta">
        <span><strong>Target:</strong> {targetLabel}</span>
        <span><strong>Status:</strong> {publicationSession.state}</span>
        <span><strong>Expires:</strong> {formatDateTime(publicationSession.expiresAt)}</span>
      </div>

      <p className="publication-access-banner__summary">{commentsSummary}</p>

      <div className="publication-access-banner__actions">
        {commentsFeatureEnabled && publicationSession.allowComments && onOpenComments ? (
          <button type="button" className="tool-button" onClick={onOpenComments}>
            Open comments
          </button>
        ) : null}
        {commentsFeatureEnabled && publicationSession.allowComments && !commentsAuthenticated && onSignIn ? (
          <button type="button" className="tool-button" onClick={onSignIn}>
            Sign in for board access
          </button>
        ) : null}
      </div>
    </section>
  );
};
