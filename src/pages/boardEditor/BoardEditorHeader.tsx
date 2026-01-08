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
  onOpenShare?: () => void;
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
  onOpenShare,
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
          onClick={onOpenShare}
          disabled={!onOpenShare}
          title="Share board"
        >
          🔗 Share…
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