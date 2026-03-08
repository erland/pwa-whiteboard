import React from 'react';
import {
  createVotingApi,
  type CreateVotingSessionInput,
  type VoteRecord,
  type VotingResults,
  type VotingSession,
} from '../../api/votingApi';
import type { WhiteboardObject } from '../../../shared/domain/types';

type VotingTarget = {
  id: string;
  label: string;
  objectType: string;
};

type UseBoardVotingArgs = {
  boardId: string;
  enabled: boolean;
  authenticated: boolean;
  selectedObjectIds: string[];
  objects: WhiteboardObject[];
};

export type BoardVotingState = {
  sessions: VotingSession[];
  selectedSessionId: string | null;
  selectedSession: VotingSession | null;
  results: VotingResults | null;
  availableTargets: VotingTarget[];
  selectedTargets: VotingTarget[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  localVotesByTarget: Record<string, number>;
  remainingVotes: number | null;
  canManage: boolean;
  canVote: boolean;
  refresh: () => Promise<void>;
  selectSession: (sessionId: string | null) => void;
  createSession: (input: CreateVotingSessionInput) => Promise<void>;
  openSession: (sessionId: string) => Promise<void>;
  closeSession: (sessionId: string) => Promise<void>;
  revealSession: (sessionId: string) => Promise<void>;
  cancelSession: (sessionId: string) => Promise<void>;
  castVote: (targetRef: string) => Promise<void>;
  removeVote: (targetRef: string) => Promise<void>;
};

function normalizeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error || 'Voting request failed.');
}

function objectLabel(object: WhiteboardObject): string {
  const text = typeof object.text === 'string' ? object.text.trim() : '';
  if (text) {
    return text.length > 36 ? `${text.slice(0, 33)}…` : text;
  }
  return `${object.type} (${object.id})`;
}

function buildTargets(objects: WhiteboardObject[], selectedObjectIds: string[], session: VotingSession | null): { available: VotingTarget[]; selected: VotingTarget[] } {
  const objectMap = new Map(objects.map((object) => [object.id, object] as const));
  const availableObjects =
    session?.scopeType === 'object' && session.scopeRef
      ? objects.filter((object) => object.id === session.scopeRef)
      : objects;

  const available = availableObjects.map((object) => ({
    id: object.id,
    label: objectLabel(object),
    objectType: object.type,
  }));

  const selected = selectedObjectIds
    .map((id) => objectMap.get(id))
    .filter((object): object is WhiteboardObject => Boolean(object))
    .map((object) => ({
      id: object.id,
      label: objectLabel(object),
      objectType: object.type,
    }));

  return { available, selected };
}

function pickInitialSessionId(sessions: VotingSession[]): string | null {
  const preferred = sessions.find((session) => session.state === 'open')
    ?? sessions.find((session) => session.state === 'closed')
    ?? sessions[0];
  return preferred?.id ?? null;
}

export function useBoardVoting({ boardId, enabled, authenticated, selectedObjectIds, objects }: UseBoardVotingArgs): BoardVotingState {
  const [sessions, setSessions] = React.useState<VotingSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<VotingResults | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isMutating, setIsMutating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [localVotesBySession, setLocalVotesBySession] = React.useState<Record<string, Record<string, number>>>({});

  const selectedSession = React.useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions]
  );

  const { available: availableTargets, selected: selectedTargets } = React.useMemo(
    () => buildTargets(objects, selectedObjectIds, selectedSession),
    [objects, selectedObjectIds, selectedSession]
  );

  const refresh = React.useCallback(async () => {
    if (!enabled || !boardId) {
      setSessions([]);
      setSelectedSessionId(null);
      setResults(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const api = createVotingApi();
      const nextSessions = await api.listSessions(boardId);
      setSessions(nextSessions);
      setSelectedSessionId((current) => {
        if (current && nextSessions.some((session) => session.id === current)) return current;
        return pickInitialSessionId(nextSessions);
      });
      setError(null);
    } catch (e) {
      setError(normalizeError(e));
    } finally {
      setIsLoading(false);
    }
  }, [boardId, enabled]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (!enabled || !boardId || !selectedSessionId) {
      setResults(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    createVotingApi()
      .getResults(boardId, selectedSessionId)
      .then((nextResults) => {
        if (cancelled) return;
        setResults(nextResults);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setResults(null);
        setError(normalizeError(e));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [boardId, enabled, selectedSessionId]);

  const runMutation = React.useCallback(async (work: () => Promise<void>) => {
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

  const createSession = React.useCallback(async (input: CreateVotingSessionInput) => {
    if (!enabled || !authenticated || !boardId) return;
    setIsMutating(true);
    try {
      const created = await createVotingApi().createSession(boardId, input);
      setError(null);
      await refresh();
      setSelectedSessionId(created.id);
    } catch (e) {
      setError(normalizeError(e));
    } finally {
      setIsMutating(false);
    }
  }, [authenticated, boardId, enabled, refresh]);

  const openSession = React.useCallback(async (sessionId: string) => {
    if (!enabled || !authenticated || !boardId) return;
    await runMutation(async () => {
      await createVotingApi().openSession(boardId, sessionId);
      setSelectedSessionId(sessionId);
    });
  }, [authenticated, boardId, enabled, runMutation]);

  const closeSession = React.useCallback(async (sessionId: string) => {
    if (!enabled || !authenticated || !boardId) return;
    await runMutation(async () => {
      await createVotingApi().closeSession(boardId, sessionId);
      setSelectedSessionId(sessionId);
    });
  }, [authenticated, boardId, enabled, runMutation]);

  const revealSession = React.useCallback(async (sessionId: string) => {
    if (!enabled || !authenticated || !boardId) return;
    await runMutation(async () => {
      await createVotingApi().revealSession(boardId, sessionId);
      setSelectedSessionId(sessionId);
    });
  }, [authenticated, boardId, enabled, runMutation]);

  const cancelSession = React.useCallback(async (sessionId: string) => {
    if (!enabled || !authenticated || !boardId) return;
    await runMutation(async () => {
      await createVotingApi().cancelSession(boardId, sessionId);
      setSelectedSessionId(sessionId);
    });
  }, [authenticated, boardId, enabled, runMutation]);

  const castVote = React.useCallback(async (targetRef: string) => {
    if (!enabled || !authenticated || !boardId || !selectedSession) return;
    await runMutation(async () => {
      const created = await createVotingApi().castVote(boardId, selectedSession.id, { targetRef, voteValue: 1 });
      setLocalVotesBySession((current) => {
        const sessionVotes = { ...(current[selectedSession.id] ?? {}) };
        sessionVotes[targetRef] = (sessionVotes[targetRef] ?? 0) + (created.voteValue ?? 1);
        return { ...current, [selectedSession.id]: sessionVotes };
      });
    });
  }, [authenticated, boardId, enabled, runMutation, selectedSession]);

  const removeVote = React.useCallback(async (targetRef: string) => {
    if (!enabled || !authenticated || !boardId || !selectedSession) return;
    await runMutation(async () => {
      await createVotingApi().removeVote(boardId, selectedSession.id, targetRef);
      setLocalVotesBySession((current) => {
        const sessionVotes = { ...(current[selectedSession.id] ?? {}) };
        delete sessionVotes[targetRef];
        return { ...current, [selectedSession.id]: sessionVotes };
      });
    });
  }, [authenticated, boardId, enabled, runMutation, selectedSession]);

  const localVotesByTarget = selectedSessionId ? (localVotesBySession[selectedSessionId] ?? {}) : {};
  const usedVotes = Object.values(localVotesByTarget).reduce((sum, value) => sum + value, 0);
  const remainingVotes = selectedSession ? Math.max(selectedSession.rules.maxVotesPerParticipant - usedVotes, 0) : null;
  const canVote = Boolean(enabled && authenticated && selectedSession && selectedSession.state === 'open');

  return {
    sessions,
    selectedSessionId,
    selectedSession,
    results,
    availableTargets,
    selectedTargets,
    isLoading,
    isMutating,
    error,
    localVotesByTarget,
    remainingVotes,
    canManage: enabled && authenticated,
    canVote,
    refresh,
    selectSession: setSelectedSessionId,
    createSession,
    openSession,
    closeSession,
    revealSession,
    cancelSession,
    castVote,
    removeVote,
  };
}
