import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BoardTypeId, WhiteboardMeta } from '../domain/types';
import { createEmptyWhiteboardState } from '../domain/whiteboardState';
import { getBoardsRepository } from '../infrastructure/localStorageBoardsRepository';
import { getWhiteboardRepository } from '../infrastructure/localStorageWhiteboardRepository';
import { BOARD_TYPE_IDS, getBoardType } from '../whiteboard/boardTypes';
import { BoardListHeader } from './boardList/components/BoardListHeader';
import { CreateBoardModal } from './boardList/components/CreateBoardModal';
import { ImportBoardModal } from './boardList/components/ImportBoardModal';
import { BoardList } from './boardList/components/BoardList';
import { parseBoardImportFile } from './boardList/importBoardJson';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

type ImportData = {
  objects: unknown[];
  viewport?: unknown;
  meta?: Partial<WhiteboardMeta>;
};

export const BoardListPage: React.FC = () => {
  const [boards, setBoards] = useState<WhiteboardMeta[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('New board');
  const [createType, setCreateType] = useState<BoardTypeId>('advanced');
  const [isCreating, setIsCreating] = useState(false);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importName, setImportName] = useState('Imported board');
  const [importType, setImportType] = useState<BoardTypeId>('advanced');
  const [importData, setImportData] = useState<ImportData | null>(null);
  const [isImporting, setIsImporting] = useState(false);

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

  const openCreateDialog = () => {
    setCreateName('New board');
    setCreateType('advanced');
    setIsCreateOpen(true);
  };

  const closeCreateDialog = () => {
    if (isCreating) return;
    setIsCreateOpen(false);
  };

  const closeImportDialog = () => {
    if (isImporting) return;
    setIsImportOpen(false);
    setImportData(null);
  };

  const handleImportFile = async (file: File) => {
    try {
      const parsed = await parseBoardImportFile(file);

      setImportName(parsed.suggestedName);
      setImportType(parsed.suggestedType);
      setImportData(parsed.payload);
      setIsImportOpen(true);
    } catch (err) {
      console.error('Failed to import board JSON', err);
      window.alert('Could not import board JSON. Please check the file format.');
    }
  };

  const handleCreateBoard = async () => {
    const name = createName.trim();
    if (!name) {
      window.alert('Please enter a board name.');
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

  const handleConfirmImport = async () => {
    if (!importData) return;

    const name = importName.trim();
    if (!name) {
      window.alert('Please enter a board name.');
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
      newMeta = await boardsRepo.createBoard(trimmed, board.boardType);

      const srcState = await wbRepo.loadBoard(board.id);

      const baseState = srcState
        ? {
            ...srcState,
            meta: newMeta,
            selectedObjectIds: [],
            history: { pastEvents: [], futureEvents: [] },
          }
        : createEmptyWhiteboardState(newMeta);

      await wbRepo.saveBoard(newMeta.id, baseState);

      setBoards((prev) => [newMeta!, ...prev]);
      navigate(`/board/${newMeta.id}`);
    } catch (err) {
      console.error('Failed to duplicate board', err);
      window.alert('Failed to duplicate board. Please try again.');
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
      <BoardListHeader title="Your Boards" onNewBoard={openCreateDialog} onImportFile={handleImportFile} />

      <CreateBoardModal
        isOpen={isCreateOpen}
        isBusy={isCreating}
        name={createName}
        boardType={createType}
        boardTypeOptions={boardTypeOptions}
        onNameChange={setCreateName}
        onBoardTypeChange={setCreateType}
        onCancel={closeCreateDialog}
        onConfirm={handleCreateBoard}
      />

      <ImportBoardModal
        isOpen={isImportOpen}
        isBusy={isImporting}
        name={importName}
        boardTypeLabel={getBoardType(importType).label}
        onNameChange={setImportName}
        onCancel={closeImportDialog}
        onConfirm={handleConfirmImport}
      />

      {loadState === 'loading' && <p>Loading boards…</p>}
      {loadState === 'error' && <p className="error-text">{error}</p>}

      {loadState === 'loaded' && boards.length === 0 && (
        <p>You have no boards yet. Click “New board” to create your first one.</p>
      )}

      {boards.length > 0 && (
        <BoardList
          boards={boards}
          onOpen={(boardId) => navigate(`/board/${boardId}`)}
          onDuplicate={handleDuplicateBoard}
          onRename={handleRenameBoard}
          onDelete={handleDeleteBoard}
        />
      )}
    </section>
  );
};
