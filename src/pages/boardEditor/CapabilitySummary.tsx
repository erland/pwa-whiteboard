import React from 'react';
import type { ServerFeatureFlags } from '../../domain/serverFeatures';

type CapabilitySummaryProps = {
  features: ServerFeatureFlags;
  isLoading: boolean;
  error: string | null;
  hideTitle?: boolean;
};

const CAPABILITY_LABELS: Array<{ key: keyof Pick<ServerFeatureFlags, 'supportsComments' | 'supportsVoting' | 'supportsPublications' | 'supportsSharedTimer' | 'supportsReactions'>; label: string }> = [
  { key: 'supportsComments', label: 'Comments' },
  { key: 'supportsVoting', label: 'Voting' },
  { key: 'supportsPublications', label: 'Publication links' },
  { key: 'supportsSharedTimer', label: 'Shared timer' },
  { key: 'supportsReactions', label: 'Reactions' },
];

export const CapabilitySummary: React.FC<CapabilitySummaryProps> = ({ features, isLoading, error, hideTitle }) => {
  return (
    <div className="share-section capability-summary" aria-live="polite">
      {!hideTitle && <div className="share-label">Server feature support</div>}
      {isLoading ? (
        <div className="share-help">Checking which collaboration features this server supports…</div>
      ) : error ? (
        <div className="share-help">Could not load server feature support: {error}</div>
      ) : (
        <>
          <div className="share-help">
            The client uses the server capability list to decide which Review &amp; Facilitation features can be enabled.
          </div>
          <div className="capability-chip-list" role="list" aria-label="Server feature support">
            {CAPABILITY_LABELS.map(({ key, label }) => {
              const enabled = Boolean(features[key]);
              return (
                <span key={key} className="capability-chip" data-enabled={enabled ? 'true' : 'false'} role="listitem">
                  {enabled ? '✅' : '⏸'} {label}
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
