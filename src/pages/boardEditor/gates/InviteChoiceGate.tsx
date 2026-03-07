import React from 'react';

export type InviteChoiceGateProps = {
  onSignIn: () => void;
  onContinueAsGuest: () => void;
  onCancel: () => void;
};

export const InviteChoiceGate: React.FC<InviteChoiceGateProps> = ({
  onSignIn,
  onContinueAsGuest,
  onCancel,
}) => {
  return (
    <section className="page page-board-editor">
      <div style={{ maxWidth: 720, margin: '2rem auto', padding: '1rem' }}>
        <h2>Invite link</h2>
        <p>This board was shared with you. Choose how you want to open it:</p>
        <ul>
          <li><strong>Sign in</strong> to accept the invite and persist your access.</li>
          <li><strong>Open without signing in</strong> to join via the invite token (guest access).</li>
        </ul>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={onSignIn}>
            Sign in
          </button>
          <button type="button" onClick={onContinueAsGuest}>
            Open without signing in
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
        <p style={{ marginTop: '1rem', opacity: 0.8 }}>
          Tip: If you just want local drawing without a server, open the app without an invite link.
        </p>
      </div>
    </section>
  );
};
