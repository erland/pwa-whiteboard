import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { ApiError } from '../../api/httpClient';
import { isWhiteboardServerConfigured } from '../../config/server';
import type { BoardTypeId, WhiteboardMeta } from '../../domain/types';
import { createEmptyWhiteboardState } from '../../domain/whiteboardState';
import { getLocalBoardsRepository, getRemoteBoardsRepository } from '../../infrastructure/localStorageBoardsRepository';
import {
  getInvitedBoardsRepository,
  type InvitedBoardRecord,
} from '../../infrastructure/localStorageInvitedBoardsRepository';
import { getWhiteboardRepository } from '../../infrastructure/localStorageWhiteboardRepository';
import { BOARD_TYPE_IDS, getBoardType } from '../../whiteboard/boardTypes';
import { parseBoardImportFile } from './importBoardJson';
import { buildDefaultBoardListSections, flattenBoardListSections } from './sections';
import type { BoardListItem, BoardListSection, BoardListSource } from './types';
import { getBoardRepositoryForSource, getEditableBoardsRepository } from './repositories';

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
  boardItems: BoardListItem[];
  boardSections: BoardListSection[];
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
  handleRenameBoard: (item: BoardListItem) => Promise<void>;
  handleDeleteBoard: (item: BoardListItem) => Promise<void>;
  handleDuplicateBoard: (item: BoardListItem) => Promise<void>;
  openBoard: (boardId: string) => void;
};

type BoardListAuth = {
  configured: boolean;
  authenticated: boolean;
  login: () => Promise<void>;
};

type BoardSourceState = {
  local: WhiteboardMeta[];
  remote: WhiteboardMeta[];
  invited: WhiteboardMeta[];
};

const EMPTY_SOURCES: BoardSourceState = {
  local: [],
  remote: [],
  invited: [],
};

function mapInvitedBoardRecordToMeta(record: InvitedBoardRecord): WhiteboardMeta {
  const updatedAt = record.lastOpenedAt || new Date().toISOString();
  return {
    id: record.boardId,
    name: record.title,
    boardType: 'advanced',
    createdAt: updatedAt,
    updatedAt,
  };
}



function updateBoardInSource(
  prev: BoardSourceState,
  source: BoardListSource,
  update: (boards: WhiteboardMeta[]) => WhiteboardMeta[]
): BoardSourceState {
  return {
    ...prev,
    [source]: update(prev[source]),
  };
}

export function useBoardListPageModel(
  auth: BoardListAuth,
  navigate: NavigateFunction
): BoardListPageModel {
  const [boardSources, setBoardSources] = useState<BoardSourceState>(EMPTY_SOURCES);
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
  const editableSource = serverConfigured ? 'remote' : 'local';

  const boardSections = useMemo(
    () => buildDefaultBoardListSections(serverConfigured, boardSources),
    [boardSources, serverConfigured]
  );

  const boards = useMemo(() => flattenBoardListSections(boardSections), [boardSections]);
  const boardItems = useMemo(() => boardSections.flatMap((section) => section.items), [boardSections]);

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
    let cancelled = false;

    async function loadBoards(): Promise<void> {
      setLoadState('loading');
      setError(null);
      setNeedsAuth(false);

      try {
        const localBoards = await getLocalBoardsRepository().listBoards();

        if (!serverConfigured) {
          if (cancelled) return;
          setBoardSources({ ...EMPTY_SOURCES, local: localBoards });
          setLoadState('loaded');
          return;
        }

        const invitedBoards = (await getInvitedBoardsRepository().listInvitedBoards()).map(mapInvitedBoardRecordToMeta);

        if (!auth.authenticated) {
          if (cancelled) return;
          setBoardSources({ ...EMPTY_SOURCES, local: localBoards, invited: invitedBoards });
          if (invitedBoards.length > 0 || localBoards.length > 0 || !auth.configured) {
            setLoadState('loaded');
          } else {
            setNeedsAuth(true);
            setError('Sign in is required to load your boards.');
            setLoadState('error');
          }
          return;
        }

        const remoteBoards = await getRemoteBoardsRepository().listBoards();
        if (cancelled) return;
        setBoardSources({ ...EMPTY_SOURCES, local: localBoards, remote: remoteBoards, invited: invitedBoards });
        setLoadState('loaded');
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load boards index', err);

        if (serverConfigured && err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          try {
            const invitedBoards = (await getInvitedBoardsRepository().listInvitedBoards()).map(mapInvitedBoardRecordToMeta);
            if (cancelled) return;
            setBoardSources({ ...EMPTY_SOURCES, invited: invitedBoards });
          } catch {
            setBoardSources(EMPTY_SOURCES);
          }
          setNeedsAuth(true);
          setError('Sign in is required to load your boards.');
        } else {
          setBoardSources(EMPTY_SOURCES);
          setError('Failed to load boards.');
        }
        setLoadState('error');
      }
    }

    void loadBoards();

    return () => {
      cancelled = true;
    };
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
    const repo = getEditableBoardsRepository(serverConfigured);
    try {
      const meta = await repo.createBoard(name, createType);
      setIsCreateOpen(false);
      setBoardSources((prev) => ({
        ...prev,
        [editableSource]: [meta, ...prev[editableSource]],
      }));
      navigate(`/board/${meta.id}`);
    } catch (err) {
      console.error('Failed to create board', err);
      window.alert('Failed to create board. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }, [createName, createType, editableSource, ensureSignedIn, navigate, serverConfigured]);

  const handleConfirmImport = useCallback(async () => {
    if (!(await ensureSignedIn())) return;
    if (!importData) return;

    const name = importName.trim();
    if (!name) {
      window.alert('Please enter a board name.');
      return;
    }

    setIsImporting(true);
    const boardsRepo = getEditableBoardsRepository(serverConfigured);
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

      setBoardSources((prev) => ({
        ...prev,
        [editableSource]: [newMeta!, ...prev[editableSource]],
      }));
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
  }, [editableSource, ensureSignedIn, importData, importName, importType, navigate, serverConfigured]);

  const handleRenameBoard = useCallback(async (item: BoardListItem) => {
    if (!item.actions.canRename) return;

    const { board, source } = item;
    const name = window.prompt('New name for this board:', board.name);
    if (name === null || name.trim() === board.name.trim()) return;

    const repo = getBoardRepositoryForSource(source);
    try {
      await repo.renameBoard(board.id, name);
      setBoardSources((prev) =>
        updateBoardInSource(prev, source, (boards) =>
          boards.map((b) =>
            b.id === board.id ? { ...b, name: name.trim(), updatedAt: new Date().toISOString() } : b
          )
        )
      );
    } catch (err) {
      console.error('Failed to rename board', err);
      window.alert('Failed to rename board. Please try again.');
    }
  }, []);

  const handleDeleteBoard = useCallback(async (item: BoardListItem) => {
    if (!item.actions.canDelete) return;

    const { board, source } = item;
    const confirmed = window.confirm(`Delete board "${board.name}"? This cannot be undone.`);
    if (!confirmed) return;

    const repo = getBoardRepositoryForSource(source);
    try {
      await repo.deleteBoard(board.id);
      setBoardSources((prev) =>
        updateBoardInSource(prev, source, (boards) => boards.filter((b) => b.id !== board.id))
      );
    } catch (err) {
      console.error('Failed to delete board', err);
      window.alert('Failed to delete board. Please try again.');
    }
  }, []);

  const handleDuplicateBoard = useCallback(async (item: BoardListItem) => {
    if (!item.actions.canDuplicate) return;

    const { board, source } = item;
    const suggested = `${board.name} (copy)`;
    const name = window.prompt('Name for the duplicated board:', suggested);
    if (name === null) return;

    const trimmed = name.trim();
    if (!trimmed) {
      window.alert('Please enter a board name.');
      return;
    }

    const boardsRepo = getBoardRepositoryForSource(source);
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

      setBoardSources((prev) =>
        updateBoardInSource(prev, source, (boards) => [newMeta!, ...boards])
      );
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
    boardItems,
    boardSections,
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
