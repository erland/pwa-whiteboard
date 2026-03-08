import React from 'react';
import type { SharedTimerState } from '../../api/timerApi';

type Props = {
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
};

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export const SharedTimerPanel: React.FC<Props> = ({
  enabled, connected, canControl, timer, displayRemainingMs, formattedRemaining, isMutating, error, onClearError, onStart, onPause, onResume, onReset, onCancelTimer, onComplete,
}) => {
  const [durationMinutes, setDurationMinutes] = React.useState('5');
  const [label, setLabel] = React.useState('');

  React.useEffect(() => {
    if (!timer) return;
    setDurationMinutes(String(Math.max(1, Math.round(timer.durationMs / 60000))));
    setLabel(timer.label ?? '');
  }, [timer]);

  const start = () => {
    const parsed = Number.parseInt(durationMinutes.trim(), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onStart({ durationMinutes: parsed, label: label.trim() || null });
  };

  if (!enabled) {
    return (
      <section className="share-panel">
        <h3>Shared timer</h3>
        <div className="share-help">This server has not advertised shared timer support for this board.</div>
      </section>
    );
  }

  return (
    <section className="share-panel">
      <h3>Shared timer</h3>

      <div className="share-section">
        <div className="share-label">Timer status</div>
        <div className="timer-summary-grid">
          <div className="timer-big-readout" aria-live="polite">{formattedRemaining}</div>
          <div className="timer-summary-meta">
            <div className="share-help">State: <strong>{timer?.state ?? 'idle'}</strong></div>
            <div className="share-help">Label: <strong>{timer?.label || 'Untitled timer'}</strong></div>
            <div className="share-help">Updated: {formatTimestamp(timer?.updatedAt)}</div>
            <div className="share-help">Ends: {formatTimestamp(timer?.endsAt)}</div>
          </div>
        </div>
        {!connected && (
          <div className="share-help">Join live collaboration to receive and control shared timer updates.</div>
        )}
      </div>

      <div className="share-section">
        <div className="share-label">Control</div>
        {!canControl ? (
          <div className="share-help">You can view the timer, but only owners and editors with an active collaboration session can control it.</div>
        ) : (
          <div className="timer-form-grid">
            <label className="form-field">
              <span>Duration minutes</span>
              <input className="text-input" type="number" min={1} value={durationMinutes} onChange={(e) => setDurationMinutes(e.currentTarget.value)} />
            </label>
            <label className="form-field">
              <span>Label</span>
              <input className="text-input" value={label} onChange={(e) => setLabel(e.currentTarget.value)} placeholder="Workshop round" />
            </label>
            <div className="capability-chip-list">
              <button type="button" className="tool-button" onClick={start} disabled={isMutating}>Start</button>
              <button type="button" className="tool-button" onClick={onPause} disabled={isMutating || !timer || timer.state !== 'running'}>Pause</button>
              <button type="button" className="tool-button" onClick={onResume} disabled={isMutating || !timer || timer.state !== 'paused'}>Resume</button>
              <button type="button" className="tool-button" onClick={() => onReset(Number.parseInt(durationMinutes.trim(), 10) || undefined)} disabled={isMutating || !timer}>Reset</button>
              <button type="button" className="tool-button" onClick={onComplete} disabled={isMutating || !timer}>Complete</button>
              <button type="button" className="tool-button" onClick={onCancelTimer} disabled={isMutating || !timer}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {timer && (
        <div className="share-section">
          <div className="share-label">Participant display</div>
          <div className="timer-participant-card">
            <strong>{timer.label || 'Shared timer'}</strong>
            <div className="timer-inline-readout">{formattedRemaining}</div>
            <div className="share-help">Remaining milliseconds: {displayRemainingMs}</div>
          </div>
        </div>
      )}

      {error && (
        <div className="error-text" role="alert">
          {error}
          <div className="comment-reply-actions">
            <button type="button" className="tool-button" onClick={onClearError}>Dismiss</button>
          </div>
        </div>
      )}
    </section>
  );
};
