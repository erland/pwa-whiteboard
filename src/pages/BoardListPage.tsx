import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WhiteboardMeta } from '../domain/types';
import { getBoardsRepository } from '../infrastructure/localStorageBoardsRepository';
import type { BoardTypeId } from '../domain/types';
import { BOARD_TYPE_IDS, getBoardType } from '../whiteboard/boardTypes';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

export const BoardListPage: React.FC = () => {
  const [boards, setBoards] = useState<WhiteboardMeta[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('New board');
  const [createType, setCreateType] = useState<BoardTypeId>('advanced');
  const [isCreating, setIsCreating] = useState(false);

  const createNameRef = useRef<HTMLInputElement | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const repo = getBoardsRepository();
    setLoadState('loading');
    setError(null);

    repo
      .listBoards()
      .then((index) => {
        setBoards(index);
        setLoadState('loaded');
      })
      .catch((err) => {
        console.error('Failed to load boards index', err);
        setError('Failed to load boards.');
        setLoadState('error');
      });
  }, []);

  const boardTypeOptions = useMemo(
    () =>
      BOARD_TYPE_IDS.map((id) => ({
        id,
        label: getBoardType(id).label,
        description: getBoardType(id).description,
      })),
    []
  );

  useEffect(() => {
    if (!isCreateOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isCreating) setIsCreateOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);

    // Small UX: focus and select default name.
    const t = window.setTimeout(() => {
      createNameRef.current?.focus();
      createNameRef.current?.select();
    }, 0);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(t);
    };
  }, [isCreateOpen, isCreating]);

  const openCreateDialog = () => {
    setCreateName('New board');
    setCreateType('advanced');
    setIsCreateOpen(true);
  };

  const closeCreateDialog = () => {
    if (isCreating) return;
    setIsCreateOpen(false);
  };

  const handleCreateBoard = async () => {
    const name = createName.trim();
    if (!name) {
      window.alert('Please enter a board name.');
      createNameRef.current?.focus();
      return;
    }

    setIsCreating(true);
    const repo = getBoardsRepository();
    try {
      const meta = await repo.createBoard(name, createType);
      setIsCreateOpen(false);
      navigate(`/board/${meta.id}`);
    } catch (err) {
      console.error('Failed to create board', err);
      window.alert('Failed to create board. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRenameBoard = async (board: WhiteboardMeta) => {
    const name = window.prompt('New name for this board:', board.name);
    if (name === null || name.trim() === board.name.trim()) return;
    const repo = getBoardsRepository();
    try {
      await repo.renameBoard(board.id, name);
      setBoards((prev) =>
        prev.map((b) =>
          b.id === board.id ? { ...b, name: name.trim(), updatedAt: new Date().toISOString() } : b
        )
      );
    } catch (err) {
      console.error('Failed to rename board', err);
      window.alert('Failed to rename board. Please try again.');
    }
  };

  const handleDeleteBoard = async (board: WhiteboardMeta) => {
    const confirmed = window.confirm(`Delete board "${board.name}"? This cannot be undone.`);
    if (!confirmed) return;

    const repo = getBoardsRepository();
    try {
      await repo.deleteBoard(board.id);
      setBoards((prev) => prev.filter((b) => b.id !== board.id));
    } catch (err) {
      console.error('Failed to delete board', err);
      window.alert('Failed to delete board. Please try again.');
    }
  };

  return (
    <section className="page page-board-list">
      <header className="page-header">
        <h1>Your Boards</h1>
        <button type="button" onClick={openCreateDialog}>
          + New board
        </button>
      </header>

      {isCreateOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            // click outside closes
            if (e.target === e.currentTarget) closeCreateDialog();
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
                  ref={createNameRef}
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateBoard();
                  }}
                  disabled={isCreating}
                />
              </label>

              <label className="form-field">
                <span className="form-label">Board type</span>
                <select
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value as BoardTypeId)}
                  disabled={isCreating}
                >
                  {boardTypeOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="form-help">
                  {boardTypeOptions.find((o) => o.id === createType)?.description ?? ''}
                </div>
              </label>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={closeCreateDialog} disabled={isCreating}>
                Cancel
              </button>
              <button type="button" onClick={handleCreateBoard} disabled={isCreating}>
                {isCreating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loadState === 'loading' && <p>Loading boards…</p>}
      {loadState === 'error' && <p className="error-text">{error}</p>}

      {loadState === 'loaded' && boards.length === 0 && (
        <p>You have no boards yet. Click “New board” to create your first one.</p>
      )}

      {boards.length > 0 && (
        <ul className="board-list">
          {boards.map((board) => (
            <li key={board.id} className="board-list-item">
              <button
                type="button"
                className="board-list-main"
                onClick={() => navigate(`/board/${board.id}`)}
              >
                <div className="board-list-name">{board.name}</div>
                <div className="board-list-meta">
                  <span>Type: {getBoardType(board.boardType).label}</span>
                  <span>Created: {new Date(board.createdAt).toLocaleString()}</span>
                  <span>Updated: {new Date(board.updatedAt).toLocaleString()}</span>
                </div>
              </button>
              <div className="board-list-actions">
                <button type="button" onClick={() => handleRenameBoard(board)}>
                  Rename
                </button>
                <button type="button" onClick={() => handleDeleteBoard(board)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
