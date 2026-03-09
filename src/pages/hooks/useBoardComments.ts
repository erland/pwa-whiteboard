import React from 'react';
import {
  createCommentsApi,
  type BoardComment,
  type BoardCommentTargetType,
} from '../../api/commentsApi';
import type { BoardAccessContext } from './publicationSession';

type CommentTarget = {
  targetType: BoardCommentTargetType;
  targetRef: string | null;
  label: string;
};

type UseBoardCommentsArgs = {
  boardId: string;
  enabled: boolean;
  authenticated: boolean;
  selectedObjectIds: string[];
  access: BoardAccessContext;
};

export type BoardCommentsState = {
  comments: BoardComment[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  allowComments: boolean;
  canCreate: boolean;
  canManage: boolean;
  viewOnlyMessage: string | null;
  target: CommentTarget;
  activeCount: number;
  resolvedCount: number;
  refresh: () => Promise<void>;
  createComment: (content: string) => Promise<void>;
  replyToComment: (parentCommentId: string, content: string) => Promise<void>;
  resolveComment: (commentId: string) => Promise<void>;
  reopenComment: (commentId: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
};

function buildTarget(selectedObjectIds: string[]): CommentTarget {
  if (selectedObjectIds.length === 1) {
    return {
      targetType: 'object',
      targetRef: selectedObjectIds[0] ?? null,
      label: `Selected object (${selectedObjectIds[0]})`,
    };
  }

  if (selectedObjectIds.length > 1) {
    return {
      targetType: 'board',
      targetRef: null,
      label: `Board-level comment (multiple objects selected)`,
    };
  }

  return {
    targetType: 'board',
    targetRef: null,
    label: 'Board-level comment',
  };
}

function normalizeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error || 'Comment request failed.');
}

export function useBoardComments({ boardId, enabled, authenticated, selectedObjectIds, access }: UseBoardCommentsArgs): BoardCommentsState {
  const [comments, setComments] = React.useState<BoardComment[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isMutating, setIsMutating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const target = React.useMemo(() => buildTarget(selectedObjectIds), [selectedObjectIds]);
  const allowComments = !access.isPublicationAccess || Boolean(access.publicationSession?.allowComments);
  const canMutate = enabled && authenticated && allowComments;
  const viewOnlyMessage = React.useMemo(() => {
    if (access.isPublicationAccess && !allowComments) {
      return 'This publication does not allow comments.';
    }
    if (access.isPublicationAccess && allowComments && !authenticated) {
      return 'This publication allows comments, but you need board access to post or manage them.';
    }
    if (!authenticated) {
      return 'Sign in to post, resolve, and manage comments.';
    }
    return null;
  }, [access.isPublicationAccess, allowComments, authenticated]);

  const refresh = React.useCallback(async () => {
    if (!enabled || !boardId) {
      setComments([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (access.isPublicationAccess && !allowComments) {
      setComments([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const api = createCommentsApi();
      const next = await api.list(
        boardId,
        access.publicationToken ? { publicationToken: access.publicationToken } : undefined
      );
      setComments(next);
      setError(null);
    } catch (e) {
      setError(normalizeError(e));
    } finally {
      setIsLoading(false);
    }
  }, [access.isPublicationAccess, access.publicationToken, allowComments, boardId, enabled]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const runMutation = React.useCallback(async (work: () => Promise<BoardComment | void>) => {
    setIsMutating(true);
    try {
      await work();
      setError(null);
      await refresh();
    } catch (e) {
      setError(normalizeError(e));
    } finally {
      setIsMutating(false);
    }
  }, [refresh]);

  const createComment = React.useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || !canMutate || !boardId) return;
    await runMutation(async () => {
      const api = createCommentsApi();
      return api.create(boardId, {
        targetType: target.targetType,
        targetRef: target.targetRef,
        content: trimmed,
      });
    });
  }, [boardId, canMutate, runMutation, target.targetRef, target.targetType]);

  const replyToComment = React.useCallback(async (parentCommentId: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed || !canMutate || !boardId) return;
    await runMutation(async () => {
      const api = createCommentsApi();
      return api.create(boardId, {
        targetType: 'comment',
        targetRef: parentCommentId,
        parentCommentId,
        content: trimmed,
      });
    });
  }, [boardId, canMutate, runMutation]);

  const resolveComment = React.useCallback(async (commentId: string) => {
    if (!canMutate || !boardId) return;
    await runMutation(async () => createCommentsApi().resolve(boardId, commentId));
  }, [boardId, canMutate, runMutation]);

  const reopenComment = React.useCallback(async (commentId: string) => {
    if (!canMutate || !boardId) return;
    await runMutation(async () => createCommentsApi().reopen(boardId, commentId));
  }, [boardId, canMutate, runMutation]);

  const deleteComment = React.useCallback(async (commentId: string) => {
    if (!canMutate || !boardId) return;
    await runMutation(async () => createCommentsApi().remove(boardId, commentId));
  }, [boardId, canMutate, runMutation]);

  const activeCount = React.useMemo(() => comments.filter((comment) => comment.state === 'active').length, [comments]);
  const resolvedCount = React.useMemo(() => comments.filter((comment) => comment.state === 'resolved').length, [comments]);

  return {
    comments,
    isLoading,
    isMutating,
    error,
    allowComments,
    canCreate: canMutate,
    canManage: canMutate,
    viewOnlyMessage,
    target,
    activeCount,
    resolvedCount,
    refresh,
    createComment,
    replyToComment,
    resolveComment,
    reopenComment,
    deleteComment,
  };
}
