import React from 'react';
import { isWhiteboardServerConfigured } from '../../config/server';
import { isOidcConfigured } from '../../auth/oidc';
import type { BoardRole } from '../../../shared/protocol';

type CollabInfo = {
  status: 'disabled' | 'idle' | 'connecting' | 'connected' | 'error' | 'closed';
  role?: BoardRole;
  usersCount?: number;
  errorText?: string;
};

type BoardEditorHeaderProps = {
  boardName?: string;
  isReadOnly?: boolean;
  canDelete?: boolean;
  canCopy?: boolean;
  canPaste?: boolean;
  onDelete?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  collab?: CollabInfo;
  commentsEnabled?: boolean;
  commentsCount?: number;
  onOpenComments?: () => void;
  onOpenShare?: () => void;
};

export const BoardEditorHeader: React.FC<BoardEditorHeaderProps> = ({
  boardName,
  isReadOnly,
  canDelete,
  canCopy,
  canPaste,
  onDelete,
  onCopy,
  onPaste,
  collab,
  commentsEnabled,
  commentsCount,
  onOpenComments,
  onOpenShare,
}) => {
  const status = collab?.status ?? 'disabled';
  const showBadge = status !== 'disabled';
  const canShare = isWhiteboardServerConfigured() && isOidcConfigured();

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
        {commentsEnabled && (
          <button
            type="button"
            className="tool-button"
            onClick={onOpenComments}
            disabled={!onOpenComments}
            title="Review comments"
          >
            💬 Comments{typeof commentsCount === 'number' ? ` (${commentsCount})` : ''}
          </button>
        )}
        {canShare && (

        <button
          type="button"
          className="tool-button"
          onClick={onOpenShare}
          disabled={!onOpenShare}
          title="Share board"
        >
          🔗 Share…
        </button>
        )}

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
          disabled={!canPaste || !!isReadOnly}
          title="Paste"
        >
          ⎘ Paste
        </button>
        <button
          type="button"
          className="tool-button"
          onClick={onDelete}
          disabled={!canDelete || !!isReadOnly}
          title="Delete selection"
        >
          🗑 Delete
        </button>
      </div>
    </header>
  );
};