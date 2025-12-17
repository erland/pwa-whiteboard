import React, { useEffect, useLayoutEffect, useRef } from 'react';
import type { BoardTypeId } from '../../../domain/types';

type BoardTypeOption = {
  id: BoardTypeId;
  label: string;
  description: string;
};

type Props = {
  isOpen: boolean;
  isBusy: boolean;
  name: string;
  boardType: BoardTypeId;
  boardTypeOptions: BoardTypeOption[];
  onNameChange: (name: string) => void;
  onBoardTypeChange: (type: BoardTypeId) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export const CreateBoardModal: React.FC<Props> = ({
  isOpen,
  isBusy,
  name,
  boardType,
  boardTypeOptions,
  onNameChange,
  onBoardTypeChange,
  onCancel,
  onConfirm,
}) => {
  const nameRef = useRef<HTMLInputElement | null>(null);

  // Focus/select synchronously when the modal opens.
  // Using a layout effect avoids a timing race where the user can start typing
  // before the focus/select happens (which can cause the next keypress to
  // overwrite the first character).
  useLayoutEffect(() => {
    if (!isOpen) return;
    const el = nameRef.current;
    if (!el) return;
    el.focus();
    // Select the prefilled name (if any) so the user can easily overwrite it.
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

  const help = boardTypeOptions.find((o) => o.id === boardType)?.description ?? '';

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label="Create board">
        <div className="modal-header">
          <h2>Create board</h2>
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

          <label className="form-field">
            <span className="form-label">Board type</span>
            <select
              value={boardType}
              onChange={(e) => onBoardTypeChange(e.target.value as BoardTypeId)}
              disabled={isBusy}
            >
              {boardTypeOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="form-help">{help}</div>
          </label>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onCancel} disabled={isBusy}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={isBusy}>
            {isBusy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};
