import React, { useEffect, useState } from 'react';
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

  const handleCreateBoard = async () => {
    const name = window.prompt('Name for the new board:', 'New board');
    if (name === null) return;

    const optionsText = BOARD_TYPE_IDS.map((id) => `${id} — ${getBoardType(id).label}`).join('\n');
    const typeInput = window.prompt(
      `Board type (enter one of: ${BOARD_TYPE_IDS.join(', ')}):\n\n${optionsText}`,
      'advanced'
    );
    if (typeInput === null) return;

    const trimmed = typeInput.trim().toLowerCase();
    const boardType: BoardTypeId = (BOARD_TYPE_IDS.includes(trimmed as BoardTypeId)
      ? (trimmed as BoardTypeId)
      : 'advanced');

    if (trimmed && boardType !== trimmed) {
      window.alert(`Unknown board type "${typeInput}". Using "advanced".`);
    }
    const repo = getBoardsRepository();
    try {
      const meta = await repo.createBoard(name, boardType);
      // Navigate directly to the newly created board
      navigate(`/board/${meta.id}`);
    } catch (err) {
      console.error('Failed to create board', err);
      window.alert('Failed to create board. Please try again.');
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
        <button type="button" onClick={handleCreateBoard}>
          + New board
        </button>
      </header>

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
