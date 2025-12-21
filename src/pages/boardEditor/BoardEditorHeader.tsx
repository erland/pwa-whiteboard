import React from 'react';
import type { BoardRole } from '../../../shared/protocol';

type CollabInfo = {
  status: 'disabled' | 'idle' | 'connecting' | 'connected' | 'error' | 'closed';
  role?: BoardRole;
  usersCount?: number;
  errorText?: string;
};

type BoardEditorHeaderProps = {
  boardName?: string;
  canDelete?: boolean;
  canCopy?: boolean;
  canPaste?: boolean;
  onDelete?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  collab?: CollabInfo;
  inviteLink?: string;
};

export const BoardEditorHeader: React.FC<BoardEditorHeaderProps> = ({
  boardName,
  canDelete,
  canCopy,
  canPaste,
  onDelete,
  onCopy,
  onPaste,
  collab,
  inviteLink,
}) => {
  const status = collab?.status ?? 'disabled';
  const showBadge = status !== 'disabled';

  const label =
    status === 'connected'
      ? `Collab: connected${collab?.role ? ` (${collab.role})` : ''}${typeof collab?.usersCount === 'number' ? ` · ${collab.usersCount} online` : ''}`
      : status === 'connecting' || status === 'idle'
        ? 'Collab: connecting…'
        : status === 'closed'
          ? 'Collab: disconnected'
          : status === 'error'
            ? 'Collab: error'
            : 'Collab: disabled';


  const labelWithError =
    (status === 'error' || status === 'closed') && collab?.errorText
      ? `${label} (${collab.errorText})`
      : label;




const [inviteCopied, setInviteCopied] = React.useState(false);

const copyInviteLink = async () => {
  if (!inviteLink) return;
  try {
    await navigator.clipboard.writeText(inviteLink);
    setInviteCopied(true);
    window.setTimeout(() => setInviteCopied(false), 1200);
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
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 1200);
    } catch {
      // Ignore
    }
  }
};

  return (
    <header className="board-editor-header">
      <h1 className="board-editor-title">{boardName || 'Board'}</h1>

      <div className="board-editor-actions">
        {showBadge && (
          <span className="collab-badge" data-status={status} title={labelWithError}>
            <span className="collab-dot" />
            <span>{labelWithError}</span>
          </span>
        )}

        <button
          type="button"
          className="tool-button"
          onClick={copyInviteLink}
          disabled={!inviteLink}
          title="Copy invite link"
        >
          🔗 {inviteCopied ? 'Copied!' : 'Copy invite link'}
        </button>

        <button
          type="button"
          className="tool-button"
          onClick={onCopy}
          disabled={!canCopy}
          title="Copy selection"
        >
          ⎘ Copy
        </button>
        <button
          type="button"
          className="tool-button"
          onClick={onPaste}
          disabled={!canPaste}
          title="Paste"
        >
          ⎘ Paste
        </button>
        <button
          type="button"
          className="tool-button"
          onClick={onDelete}
          disabled={!canDelete}
          title="Delete selection"
        >
          🗑 Delete
        </button>
      </div>
    </header>
  );
};