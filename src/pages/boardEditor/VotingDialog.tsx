import React from 'react';
import { VotingPanel } from './VotingPanel';
import type { VotingResults, VotingSession } from '../../api/votingApi';

type VotingTarget = {
  id: string;
  label: string;
  objectType: string;
};

type Props = {
  isOpen: boolean;
  boardName?: string;
  enabled: boolean;
  authenticated: boolean;
  sessions: VotingSession[];
  selectedSessionId: string | null;
  results: VotingResults | null;
  availableTargets: VotingTarget[];
  selectedTargets: VotingTarget[];
  localVotesByTarget: Record<string, number>;
  remainingVotes: number | null;
  canManage: boolean;
  canVote: boolean;
  participantMode: 'member' | 'publication-member' | 'publication-reader' | 'guest';
  participantToken: string | null;
  canUsePublicationParticipation: boolean;
  onResetParticipantToken: () => void;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  onRefresh: () => Promise<void> | void;
  onSelectSession: (sessionId: string | null) => void;
  onCreateSession: (input: any) => Promise<void> | void;
  onOpenSession: (sessionId: string) => Promise<void> | void;
  onCloseSession: (sessionId: string) => Promise<void> | void;
  onRevealSession: (sessionId: string) => Promise<void> | void;
  onCancelSession: (sessionId: string) => Promise<void> | void;
  onCastVote: (targetRef: string) => Promise<void> | void;
  onRemoveVote: (targetRef: string) => Promise<void> | void;
  onCancel: () => void;
};

export const VotingDialog: React.FC<Props> = ({ isOpen, onCancel, ...panelProps }) => {
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
      <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Board voting">
        <div className="modal-header">
          <h2>Voting</h2>
        </div>
        <div className="modal-body">
          <VotingPanel {...panelProps} />
        </div>
        <div className="modal-footer">
          <button type="button" className="tool-button" onClick={onCancel}>Close</button>
        </div>
      </div>
    </div>
  );
};
