import React from 'react';
import { SharedTimerPanel } from './SharedTimerPanel';
import type { SharedTimerState } from '../../api/timerApi';

type Props = {
  isOpen: boolean;
  enabled: boolean;
  connected: boolean;
  canControl: boolean;
  timer: SharedTimerState | null;
  displayRemainingMs: number;
  formattedRemaining: string;
  isMutating: boolean;
  error: string | null;
  onClearError: () => void;
  onStart: (input: { durationMinutes: number; label?: string | null }) => void;
  onPause: () => void;
  onResume: () => void;
  onReset: (durationMinutes?: number) => void;
  onCancelTimer: () => void;
  onComplete: () => void;
  onCancel: () => void;
};

export const SharedTimerDialog: React.FC<Props> = ({ isOpen, onCancel, ...panelProps }) => {
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
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Shared timer">
        <div className="modal-header">
          <h2>Shared timer</h2>
        </div>
        <div className="modal-body">
          <SharedTimerPanel {...panelProps} />
        </div>
        <div className="modal-footer">
          <button type="button" className="tool-button" onClick={onCancel}>Close</button>
        </div>
      </div>
    </div>
  );
};
