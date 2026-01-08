import React, { useEffect, useMemo, useState } from 'react';
import { SharePanel } from './SharePanel';

type Props = {
  isOpen: boolean;
  boardId: string;
  boardName: string;
  inviteLink?: string;
  onCancel: () => void;
};

export const ShareDialog: React.FC<Props> = ({ isOpen, boardId, boardName, inviteLink, onCancel }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onCancel]);

  const canCopyInvite = !!inviteLink;

  const handleCopyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Fallback for older browsers / insecure contexts
      try {
        const ta = document.createElement('textarea');
        ta.value = inviteLink;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      } catch {
        // ignore
      }
    }
  };

  // Avoid re-rendering the panel while the dialog is closed.
  const panel = useMemo(() => {
    if (!isOpen) return null;
    return <SharePanel boardId={boardId} boardName={boardName} hideTitle />;
  }, [isOpen, boardId, boardName]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Share board">
        <div className="modal-header">
          <h2>Share</h2>
        </div>

        <div className="modal-body">
          {inviteLink && (
            <div className="share-current-invite">
              <div className="form-help">
                You opened this board using an invite link. You can copy that link again here.
              </div>
              <div className="share-invite-url">
                <input type="text" readOnly value={inviteLink} aria-label="Current invite link" />
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="tool-button" onClick={handleCopyInviteLink} disabled={!canCopyInvite}>
                    🔗 {copied ? 'Copied!' : 'Copy current invite link'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {panel}
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
