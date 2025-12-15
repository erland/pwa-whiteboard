import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WhiteboardMeta } from '../domain/types';
import { getBoardsRepository } from '../infrastructure/localStorageBoardsRepository';
import { getWhiteboardRepository } from '../infrastructure/localStorageWhiteboardRepository';
import type { BoardTypeId } from '../domain/types';
import { BOARD_TYPE_IDS, getBoardType } from '../whiteboard/boardTypes';
import { createEmptyWhiteboardState } from '../domain/whiteboardState';

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

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importName, setImportName] = useState('Imported board');
  const [importType, setImportType] = useState<BoardTypeId>('advanced');
  const [importData, setImportData] = useState<{
    objects: unknown[];
    viewport?: unknown;
    meta?: Partial<WhiteboardMeta>;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const importNameRef = useRef<HTMLInputElement | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    if (!isImportOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isImporting) {
        setIsImportOpen(false);
        setImportData(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    const t = window.setTimeout(() => {
      importNameRef.current?.focus();
      importNameRef.current?.select();
    }, 0);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(t);
    };
  }, [isImportOpen, isImporting]);

  const openCreateDialog = () => {
    setCreateName('New board');
    setCreateType('advanced');
    setIsCreateOpen(true);
  };

  const closeCreateDialog = () => {
    if (isCreating) return;
    setIsCreateOpen(false);
  };

  const handleImportClick = () => {
    importFileInputRef.current?.click();
  };

  const handleImportFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data: any = JSON.parse(text);

      if (!data || typeof data !== 'object') throw new Error('Invalid JSON');
      if (!Array.isArray(data.objects)) throw new Error('File does not contain a valid objects array');

      const importedMeta = (data.meta ?? {}) as Partial<WhiteboardMeta>;
      const suggestedName =
        typeof importedMeta.name === 'string' && importedMeta.name.trim()
          ? `${importedMeta.name.trim()} (import)`
          : 'Imported board';

      const nextType: BoardTypeId =
        typeof importedMeta.boardType === 'string' && (BOARD_TYPE_IDS as readonly string[]).includes(importedMeta.boardType)
          ? (importedMeta.boardType as BoardTypeId)
          : 'advanced';

      setImportName(suggestedName);
      setImportType(nextType);
      setImportData({
        objects: data.objects as unknown[],
        viewport: data.viewport,
        meta: importedMeta,
      });
      setIsImportOpen(true);
    } catch (err) {
      console.error('Failed to import board JSON', err);
      window.alert('Could not import board JSON. Please check the file format.');
    } finally {
      // Allow selecting the same file again.
      e.target.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!importData) return;

    const name = importName.trim();
    if (!name) {
      window.alert('Please enter a board name.');
      importNameRef.current?.focus();
      return;
    }

    setIsImporting(true);
    const boardsRepo = getBoardsRepository();
    const wbRepo = getWhiteboardRepository();

    let newMeta: WhiteboardMeta | null = null;
    try {
      newMeta = await boardsRepo.createBoard(name, importType);

      const base = createEmptyWhiteboardState(newMeta);
      const now = new Date().toISOString();

      const importedViewport = importData.viewport && typeof importData.viewport === 'object' ? importData.viewport : null;

      const nextState = {
        ...base,
        meta: {
          ...base.meta,
          // Ensure updatedAt reflects the import moment.
          updatedAt: now,
        },
        objects: importData.objects as any,
        selectedObjectIds: [],
        viewport: importedViewport ? (importedViewport as any) : base.viewport,
        history: { pastEvents: [], futureEvents: [] },
      };

      await wbRepo.saveBoard(newMeta.id, nextState as any);

      setBoards((prev) => [newMeta!, ...prev]);
      setIsImportOpen(false);
      setImportData(null);
      navigate(`/board/${newMeta.id}`);
    } catch (err) {
      console.error('Failed to import board', err);
      window.alert('Failed to import board. Please try again.');
      if (newMeta) {
        try {
          await boardsRepo.deleteBoard(newMeta.id);
        } catch {
          // ignore
        }
      }
    } finally {
      setIsImporting(false);
    }
  };

  const closeImportDialog = () => {
    if (isImporting) return;
    setIsImportOpen(false);
    setImportData(null);
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

  const handleDuplicateBoard = async (board: WhiteboardMeta) => {
    const suggested = `${board.name} (copy)`;
    const name = window.prompt('Name for the duplicated board:', suggested);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) {
      window.alert('Please enter a board name.');
      return;
    }

    const boardsRepo = getBoardsRepository();
    const wbRepo = getWhiteboardRepository();

    let newMeta: WhiteboardMeta | null = null;
    try {
      // Create new board metadata first (new id, timestamps, same boardType).
      newMeta = await boardsRepo.createBoard(trimmed, board.boardType);

      // Load source board state (if any). If missing, duplicate just creates an empty board.
      const srcState = await wbRepo.loadBoard(board.id);

      const baseState = srcState
        ? {
            ...srcState,
            meta: newMeta,
            selectedObjectIds: [],
            // Do not carry undo/redo across boards.
            history: { pastEvents: [], futureEvents: [] },
          }
        : createEmptyWhiteboardState(newMeta);

      await wbRepo.saveBoard(newMeta.id, baseState);

      // Optimistic UI update if user stays on list (we navigate right away).
      setBoards((prev) => [newMeta!, ...prev]);
      navigate(`/board/${newMeta.id}`);
    } catch (err) {
      console.error('Failed to duplicate board', err);
      window.alert('Failed to duplicate board. Please try again.');
      // Best effort cleanup if we created meta but failed to copy/save the state.
      if (newMeta) {
        try {
          await boardsRepo.deleteBoard(newMeta.id);
        } catch {
          // ignore
        }
      }
    }
  };

  return (
    <section className="page page-board-list">
      <header className="page-header">
        <h1>Your Boards</h1>
        <div className="page-header-actions">
          <button type="button" onClick={handleImportClick}>
            Import
          </button>
          <button type="button" onClick={openCreateDialog}>
            + New board
          </button>
          <input
            ref={importFileInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={handleImportFileChange}
          />
        </div>
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

      {isImportOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeImportDialog();
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
                  ref={importNameRef}
                  type="text"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmImport();
                  }}
                  disabled={isImporting}
                />
              </label>

              <div className="form-help">
                Imported board type: <strong>{getBoardType(importType).label}</strong>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={closeImportDialog} disabled={isImporting}>
                Cancel
              </button>
              <button type="button" onClick={handleConfirmImport} disabled={isImporting}>
                {isImporting ? 'Importing…' : 'Import'}
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
                <button type="button" onClick={() => handleDuplicateBoard(board)}>
                  Duplicate
                </button>
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
