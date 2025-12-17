import React, { useEffect, useLayoutEffect, useRef } from 'react';

type Props = {
  isOpen: boolean;
  isBusy: boolean;
  name: string;
  boardTypeLabel: string;
  onNameChange: (name: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export const ImportBoardModal: React.FC<Props> = ({
  isOpen,
  isBusy,
  name,
  boardTypeLabel,
  onNameChange,
  onCancel,
  onConfirm,
}) => {
  const nameRef = useRef<HTMLInputElement | null>(null);

  // Focus/select synchronously when the modal opens to avoid a race where the
  // user types before our focus/select runs (which can cause later keypresses
  // to overwrite the first character).
  useLayoutEffect(() => {
    if (!isOpen) return;
    const el = nameRef.current;
    if (!el) return;
    el.focus();
    if (el.value.length > 0) {
      el.setSelectionRange(0, el.value.length);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, isBusy, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label="Import board">
        <div className="modal-header">
          <h2>Import board</h2>
        </div>

        <div className="modal-body">
          <label className="form-field">
            <span className="form-label">Name</span>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onConfirm();
              }}
              disabled={isBusy}
            />
          </label>

          <div className="form-help">
            Imported board type: <strong>{boardTypeLabel}</strong>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onCancel} disabled={isBusy}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={isBusy}>
            {isBusy ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
};
