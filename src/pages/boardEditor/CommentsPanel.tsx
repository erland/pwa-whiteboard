import React from 'react';
import type { BoardComment } from '../../api/commentsApi';

type CommentsPanelProps = {
  enabled: boolean;
  authenticated: boolean;
  canCreate: boolean;
  canManage: boolean;
  viewOnlyMessage: string | null;
  boardName?: string;
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
};

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function buildThreadTree(comments: BoardComment[]): Array<BoardComment & { replies: BoardComment[] }> {
  const byParent = new Map<string | null, BoardComment[]>();
  for (const comment of comments) {
    const list = byParent.get(comment.parentCommentId) ?? [];
    list.push(comment);
    byParent.set(comment.parentCommentId, list);
  }

  const sortByCreatedAt = (a: BoardComment, b: BoardComment) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return ta - tb;
  };

  const buildNode = (comment: BoardComment): BoardComment & { replies: BoardComment[] } => ({
    ...comment,
    replies: [...(byParent.get(comment.id) ?? [])].sort(sortByCreatedAt),
  });

  return [...(byParent.get(null) ?? [])].sort(sortByCreatedAt).map(buildNode);
}

const CommentThread: React.FC<{
  comment: BoardComment & { replies: BoardComment[] };
  canManage: boolean;
  isMutating: boolean;
  onReplyToComment: (parentCommentId: string, content: string) => Promise<void> | void;
  onResolveComment: (commentId: string) => Promise<void> | void;
  onReopenComment: (commentId: string) => Promise<void> | void;
  onDeleteComment: (commentId: string) => Promise<void> | void;
}> = ({ comment, canManage, isMutating, onReplyToComment, onResolveComment, onReopenComment, onDeleteComment }) => {
  const [replyOpen, setReplyOpen] = React.useState(false);
  const [replyText, setReplyText] = React.useState('');

  const isResolved = comment.state === 'resolved';
  const isDeleted = comment.state === 'deleted';

  const submitReply = async () => {
    if (!replyText.trim()) return;
    await onReplyToComment(comment.id, replyText);
    setReplyText('');
    setReplyOpen(false);
  };

  return (
    <article className="comment-card" data-state={comment.state}>
      <header className="comment-card-header">
        <div>
          <div className="comment-card-meta">
            <strong>{comment.authorUserId}</strong>
            <span>{formatTimestamp(comment.updatedAt || comment.createdAt)}</span>
            <span className="comment-status-badge">{comment.state}</span>
          </div>
          <div className="comment-card-target">
            {comment.targetType}
            {comment.targetRef ? ` · ${comment.targetRef}` : ''}
          </div>
        </div>
        <div className="comment-card-actions">
          {canManage && !isDeleted && (
            <>
              <button type="button" className="tool-button" onClick={() => setReplyOpen((value) => !value)} disabled={isMutating}>
                {replyOpen ? 'Cancel reply' : 'Reply'}
              </button>
              {isResolved ? (
                <button type="button" className="tool-button" onClick={() => onReopenComment(comment.id)} disabled={isMutating}>
                  Reopen
                </button>
              ) : (
                <button type="button" className="tool-button" onClick={() => onResolveComment(comment.id)} disabled={isMutating}>
                  Resolve
                </button>
              )}
              <button type="button" className="tool-button" onClick={() => onDeleteComment(comment.id)} disabled={isMutating}>
                Delete
              </button>
            </>
          )}
        </div>
      </header>

      <div className="comment-card-body">{isDeleted ? <em>Comment deleted.</em> : comment.content}</div>

      {replyOpen && canManage && !isDeleted && (
        <div className="comment-reply-form">
          <textarea
            className="text-input"
            rows={3}
            placeholder="Reply to this comment"
            value={replyText}
            onChange={(e) => setReplyText(e.currentTarget.value)}
          />
          <div className="comment-reply-actions">
            <button type="button" className="tool-button" onClick={submitReply} disabled={isMutating || !replyText.trim()}>
              {isMutating ? 'Saving…' : 'Post reply'}
            </button>
          </div>
        </div>
      )}

      {comment.replies.length > 0 && (
        <div className="comment-replies">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="comment-reply-item" data-state={reply.state}>
              <div className="comment-card-meta">
                <strong>{reply.authorUserId}</strong>
                <span>{formatTimestamp(reply.updatedAt || reply.createdAt)}</span>
                <span className="comment-status-badge">{reply.state}</span>
              </div>
              <div className="comment-card-body">{reply.state === 'deleted' ? <em>Comment deleted.</em> : reply.content}</div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
};

export const CommentsPanel: React.FC<CommentsPanelProps> = ({
  enabled,
  authenticated,
  canCreate,
  canManage,
  viewOnlyMessage,
  boardName,
  targetLabel,
  comments,
  isLoading,
  isMutating,
  error,
  activeCount,
  resolvedCount,
  onRefresh,
  onCreateComment,
  onReplyToComment,
  onResolveComment,
  onReopenComment,
  onDeleteComment,
}) => {
  const [newComment, setNewComment] = React.useState('');

  const threads = React.useMemo(() => buildThreadTree(comments), [comments]);

  const submitNewComment = async () => {
    if (!newComment.trim()) return;
    await onCreateComment(newComment);
    setNewComment('');
  };

  if (!enabled) {
    return (
      <section className="share-panel">
        <h3>Comments</h3>
        <div className="share-help">This server has not advertised durable comments support for this board.</div>
      </section>
    );
  }

  return (
    <section className="share-panel">
      <h3>Comments</h3>

      <div className="share-section">
        <div className="share-label">Review context</div>
        <div className="share-help">
          Board: <code>{boardName || 'Untitled board'}</code>
        </div>
        <div className="share-help">New comments will target: {targetLabel}.</div>
        <div className="capability-chip-list">
          <span className="capability-chip" data-enabled="true">Active {activeCount}</span>
          <span className="capability-chip" data-enabled={resolvedCount > 0 ? 'true' : 'false'}>Resolved {resolvedCount}</span>
          <button type="button" className="tool-button" onClick={() => void onRefresh()} disabled={isLoading || isMutating}>
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="share-section">
        <div className="share-label">New comment</div>
        {!canCreate ? (
          <div className="share-help">{viewOnlyMessage ?? 'Sign in to post, resolve, and manage comments.'}</div>
        ) : (
          <>
            <textarea
              className="text-input"
              rows={4}
              placeholder="Leave review feedback for this board or the selected object"
              value={newComment}
              onChange={(e) => setNewComment(e.currentTarget.value)}
            />
            <div className="comment-reply-actions">
              <button type="button" className="tool-button" onClick={submitNewComment} disabled={isMutating || !newComment.trim()}>
                {isMutating ? 'Saving…' : 'Post comment'}
              </button>
            </div>
          </>
        )}
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="share-section">
        <div className="share-label">Conversation</div>
        {isLoading ? (
          <div className="share-help">Loading comments…</div>
        ) : threads.length === 0 ? (
          <div className="share-help">No comments yet. Start a review thread for the board or the selected object.</div>
        ) : (
          <div className="comment-thread-list">
            {threads.map((thread) => (
              <CommentThread
                key={thread.id}
                comment={thread}
                canManage={canManage}
                isMutating={isMutating}
                onReplyToComment={onReplyToComment}
                onResolveComment={onResolveComment}
                onReopenComment={onReopenComment}
                onDeleteComment={onDeleteComment}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
