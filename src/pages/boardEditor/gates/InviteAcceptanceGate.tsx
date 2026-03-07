import React from 'react';

export type InviteAcceptanceGateProps = {
  acceptingInvite: boolean;
  inviteError: string | null;
  onRetry: () => void;
  onBack: () => void;
};

export const InviteAcceptanceGate: React.FC<InviteAcceptanceGateProps> = ({
  acceptingInvite,
  inviteError,
  onRetry,
  onBack,
}) => {
  return (
    <section className="page page-board-editor">
      <div style={{ maxWidth: 720, margin: '2rem auto', padding: '1rem' }}>
        <h2>Opening shared board…</h2>
        {acceptingInvite ? <p>Accepting invite…</p> : null}
        {inviteError ? (
          <>
            <p style={{ color: 'crimson' }}>{inviteError}</p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={onRetry}>
                Retry
              </button>
              <button type="button" onClick={onBack}>
                Back
              </button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
};
