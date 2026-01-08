import React, { useEffect } from 'react';

type InviteRole = 'viewer' | 'editor';

type Props = {
  isOpen: boolean;
  role: InviteRole;
  label: string;
  expiryPreset: '7d' | '30d' | 'never';
  creating: boolean;
  canCreate: boolean;
  lastCreatedInviteUrl: string | null;
  lastCreatedInviteCopied: boolean;
  onChangeRole: (role: InviteRole) => void;
  onChangeLabel: (label: string) => void;
  onChangeExpiryPreset: (preset: '7d' | '30d' | 'never') => void;
  onCreate: () => void;
  onCopyLastCreatedInvite: () => void;
  onCancel: () => void;
};

export const CreateInviteDialog: React.FC<Props> = ({
  isOpen,
  role,
  label,
  expiryPreset,
  creating,
  canCreate,
  lastCreatedInviteUrl,
  lastCreatedInviteCopied,
  onChangeRole,
  onChangeLabel,
  onChangeExpiryPreset,
  onCreate,
  onCopyLastCreatedInvite,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      style={{ zIndex: 60 }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label="Create invite">
        <div className="modal-header">
          <h2 style={{ margin: 0 }}>Create invite</h2>
        </div>

        <div className="modal-body">
          <div style={{ display: 'grid', gap: 10 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="form-help">Role</span>
              <select
                value={role}
                onChange={(e) => onChangeRole(e.currentTarget.value as InviteRole)}
                disabled={creating || !canCreate}
              >
                <option value="viewer">viewer</option>
                <option value="editor">editor</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span className="form-help">Label (optional)</span>
              <input
                type="text"
                value={label}
                onChange={(e) => onChangeLabel(e.currentTarget.value)}
                placeholder="e.g. Project group / Stakeholders / Review"
                disabled={creating || !canCreate}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span className="form-help">Expiry</span>
              <select
                value={expiryPreset}
                onChange={(e) => onChangeExpiryPreset(e.currentTarget.value as '7d' | '30d' | 'never')}
                disabled={creating || !canCreate}
              >
                <option value="7d">Expires in 7 days</option>
                <option value="30d">Expires in 30 days</option>
                <option value="never">Never expires</option>
              </select>
            </label>

            <button
              type="button"
              className="tool-button"
              onClick={onCreate}
              disabled={creating || !canCreate}
              title="Create a new invite link"
            >
              {creating ? 'Creating…' : 'Create invite'}
            </button>

            {lastCreatedInviteUrl && (
              <div style={{ marginTop: 6 }}>
                <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>
                  One-time link (only shown once — copy it now):
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <input type="text" readOnly value={lastCreatedInviteUrl} />
                  <button type="button" className="tool-button" onClick={onCopyLastCreatedInvite}>
                    {lastCreatedInviteCopied ? 'Copied!' : 'Copy link'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="tool-button" onClick={onCancel}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
