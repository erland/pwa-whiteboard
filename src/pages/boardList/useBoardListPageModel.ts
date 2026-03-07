import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { ApiError } from '../../api/httpClient';
import { isWhiteboardServerConfigured } from '../../config/server';
import type { BoardTypeId, WhiteboardMeta } from '../../domain/types';
import { createEmptyWhiteboardState } from '../../domain/whiteboardState';
import { getBoardsRepository } from '../../infrastructure/localStorageBoardsRepository';
import { getWhiteboardRepository } from '../../infrastructure/localStorageWhiteboardRepository';
import { BOARD_TYPE_IDS, getBoardType } from '../../whiteboard/boardTypes';
import { parseBoardImportFile } from './importBoardJson';

export type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

export type ImportData = {
  objects: unknown[];
  viewport?: unknown;
  meta?: Partial<WhiteboardMeta>;
};

export type BoardTypeOption = {
  id: BoardTypeId;
  label: string;
  description: string;
};

export type BoardListPageModel = {
  boards: WhiteboardMeta[];
  loadState: LoadState;
  error: string | null;
  needsAuth: boolean;
  isCreateOpen: boolean;
  createName: string;
  createType: BoardTypeId;
  isCreating: boolean;
  isImportOpen: boolean;
  importName: string;
  importType: BoardTypeId;
  isImporting: boolean;
  boardTypeOptions: BoardTypeOption[];
  openCreateDialog: () => void;
  closeCreateDialog: () => void;
  closeImportDialog: () => void;
  setCreateName: (name: string) => void;
  setCreateType: (type: BoardTypeId) => void;
  setImportName: (name: string) => void;
  handleSignIn: () => Promise<void>;
  handleImportFile: (file: File) => Promise<void>;
  handleCreateBoard: () => Promise<void>;
  handleConfirmImport: () => Promise<void>;
  handleRenameBoard: (board: WhiteboardMeta) => Promise<void>;
  handleDeleteBoard: (board: WhiteboardMeta) => Promise<void>;
  handleDuplicateBoard: (board: WhiteboardMeta) => Promise<void>;
  openBoard: (boardId: string) => void;
};

type BoardListAuth = {
  configured: boolean;
  authenticated: boolean;
  login: () => Promise<void>;
};

export function useBoardListPageModel(
  auth: BoardListAuth,
  navigate: NavigateFunction
): BoardListPageModel {
  const [boards, setBoards] = useState<WhiteboardMeta[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('New board');
  const [createType, setCreateType] = useState<BoardTypeId>('advanced');
  const [isCreating, setIsCreating] = useState(false);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importName, setImportName] = useState('Imported board');
  const [importType, setImportType] = useState<BoardTypeId>('advanced');
  const [importData, setImportData] = useState<ImportData | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const serverConfigured = isWhiteboardServerConfigured();

  const boardTypeOptions = useMemo(
    () =>
      BOARD_TYPE_IDS.map((id) => ({
        id,
        label: getBoardType(id).label,
        description: getBoardType(id).description,
      })),
    []
  );

  const openBoard = useCallback(
    (boardId: string) => {
      navigate(`/board/${boardId}`);
    },
    [navigate]
  );

  const handleSignIn = useCallback(async () => {
    await auth.login();
  }, [auth]);

  const ensureSignedIn = useCallback(async (): Promise<boolean> => {
    if (!serverConfigured) return true;
    if (!auth.configured) {
      setError('Authentication is not configured. Please provide OIDC settings in config.json.');
      setLoadState('error');
      return false;
    }
    if (auth.authenticated) return true;
    setNeedsAuth(true);
    setError('Sign in is required to use server-backed boards.');
    setLoadState('error');
    await auth.login();
    return false;
  }, [auth, serverConfigured]);

  useEffect(() => {
    if (serverConfigured) {
      if (!auth.configured) {
        setBoards([]);
        setNeedsAuth(false);
        setError('Authentication is not configured. Please provide OIDC settings in config.json.');
        setLoadState('error');
        return;
      }
      if (!auth.authenticated) {
        setBoards([]);
        setNeedsAuth(true);
        setError('Sign in is required to load your boards.');
        setLoadState('error');
        return;
      }
    }

    const repo = getBoardsRepository();
    setLoadState('loading');
    setError(null);
    setNeedsAuth(false);

    repo
      .listBoards()
      .then((index) => {
        setBoards(index);
        setLoadState('loaded');
      })
      .catch((err) => {
        console.error('Failed to load boards index', err);
        if (serverConfigured && err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setNeedsAuth(true);
          setError('Sign in is required to load your boards.');
        } else {
          setError('Failed to load boards.');
        }
        setLoadState('error');
      });
  }, [serverConfigured, auth.configured, auth.authenticated]);

  const openCreateDialog = useCallback(() => {
    setCreateName('New board');
    setCreateType('advanced');
    setIsCreateOpen(true);
  }, []);

  const closeCreateDialog = useCallback(() => {
    if (isCreating) return;
    setIsCreateOpen(false);
  }, [isCreating]);

  const closeImportDialog = useCallback(() => {
    if (isImporting) return;
    setIsImportOpen(false);
    setImportData(null);
  }, [isImporting]);

  const handleImportFile = useCallback(async (file: File) => {
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
  }, []);

  const handleCreateBoard = useCallback(async () => {
    if (!(await ensureSignedIn())) return;
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
  }, [createName, createType, ensureSignedIn, navigate]);

  const handleConfirmImport = useCallback(async () => {
    if (!(await ensureSignedIn())) return;
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
  }, [ensureSignedIn, importData, importName, importType, navigate]);

  const handleRenameBoard = useCallback(async (board: WhiteboardMeta) => {
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
  }, []);

  const handleDeleteBoard = useCallback(async (board: WhiteboardMeta) => {
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
  }, []);

  const handleDuplicateBoard = useCallback(async (board: WhiteboardMeta) => {
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
  }, [navigate]);

  return {
    boards,
    loadState,
    error,
    needsAuth,
    isCreateOpen,
    createName,
    createType,
    isCreating,
    isImportOpen,
    importName,
    importType,
    isImporting,
    boardTypeOptions,
    openCreateDialog,
    closeCreateDialog,
    closeImportDialog,
    setCreateName,
    setCreateType,
    setImportName,
    handleSignIn,
    handleImportFile,
    handleCreateBoard,
    handleConfirmImport,
    handleRenameBoard,
    handleDeleteBoard,
    handleDuplicateBoard,
    openBoard,
  };
}
