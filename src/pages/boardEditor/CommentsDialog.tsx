import React from 'react';
import { CommentsPanel } from './CommentsPanel';
import type { BoardComment } from '../../api/commentsApi';

type Props = {
  isOpen: boolean;
  boardName?: string;
  enabled: boolean;
  authenticated: boolean;
  canCreate: boolean;
  canManage: boolean;
  viewOnlyMessage: string | null;
  targetLabel: string;
  comments: BoardComment[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  activeCount: number;
  resolvedCount: number;
  onRefresh: () => Promise<void> | void;
  onCreateComment: (content: string) => Promise<void> | void;
  onReplyToComment: (parentCommentId: string, content: string) => Promise<void> | void;
  onResolveComment: (commentId: string) => Promise<void> | void;
  onReopenComment: (commentId: string) => Promise<void> | void;
  onDeleteComment: (commentId: string) => Promise<void> | void;
  onCancel: () => void;
};

export const CommentsDialog: React.FC<Props> = ({ isOpen, onCancel, ...panelProps }) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Board comments">
        <div className="modal-header">
          <h2>Comments</h2>
        </div>
        <div className="modal-body">
          <CommentsPanel {...panelProps} />
        </div>
        <div className="modal-footer">
          <button type="button" className="tool-button" onClick={onCancel}>Close</button>
        </div>
      </div>
    </div>
  );
};
