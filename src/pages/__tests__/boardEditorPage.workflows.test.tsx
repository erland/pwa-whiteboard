import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { BoardEditorPage } from '../BoardEditorPage';

const mockUseAuth = jest.fn();
const mockValidateInvite = jest.fn();
const mockAcceptInvite = jest.fn();
const mockUseBoardEditor = jest.fn();
const mockSaveInvitedBoard = jest.fn();
const mockGetInvitedBoard = jest.fn();

jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../config/server', () => ({
  isWhiteboardServerConfigured: () => true,
  isOidcConfigured: () => true,
}));

jest.mock('../../api/invitesApi', () => ({
  validateInvite: (...args: unknown[]) => mockValidateInvite(...args),
  acceptInvite: (...args: unknown[]) => mockAcceptInvite(...args),
}));

jest.mock('../hooks/useBoardEditor', () => ({
  useBoardEditor: (...args: unknown[]) => mockUseBoardEditor(...args),
}));

jest.mock('../../infrastructure/localStorageInvitedBoardsRepository', () => ({
  getInvitedBoardsRepository: () => ({
    saveInvitedBoard: (...args: unknown[]) => mockSaveInvitedBoard(...args),
    getInvitedBoard: (...args: unknown[]) => mockGetInvitedBoard(...args),
  }),
}));

jest.mock('../boardEditor/BoardEditorShell', () => ({
  BoardEditorShell: (props: any) => (
    <div>
      <div data-testid="board-editor-shell">shell for {props.boardId}</div>
      <div data-testid="shell-invite-token">{props.inviteToken ?? ''}</div>
      <div data-testid="shell-invite-accepted">{String(Boolean(props.inviteAccepted))}</div>
      <div data-testid="shell-invite-error">{props.inviteError ?? ''}</div>
    </div>
  ),
}));

jest.mock('../boardEditor/gates/InviteChoiceGate', () => ({
  InviteChoiceGate: ({ onSignIn, onContinueAsGuest, onCancel }: any) => (
    <div>
      <div>Invite choice gate</div>
      <button onClick={onSignIn}>Sign in</button>
      <button onClick={onContinueAsGuest}>Continue as guest</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

jest.mock('../boardEditor/gates/InviteAcceptanceGate', () => ({
  InviteAcceptanceGate: ({ acceptingInvite, inviteError, onRetry, onBack }: any) => (
    <div>
      <div>Invite acceptance gate</div>
      <div data-testid="accepting-state">{String(Boolean(acceptingInvite))}</div>
      <div data-testid="invite-error">{inviteError ?? ''}</div>
      <button onClick={onRetry}>Retry</button>
      <button onClick={onBack}>Back</button>
    </div>
  ),
}));

function renderAt(url: string) {
  const parsed = new URL(url);
  window.history.replaceState({}, '', parsed.toString());
  return render(
    <MemoryRouter initialEntries={[parsed.pathname + parsed.search]}>
      <Routes>
        <Route path="/board/:id" element={<BoardEditorPage />} />
        <Route path="/" element={<div>boards home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('BoardEditorPage real workflow verification', () => {
  beforeEach(() => {
    mockValidateInvite.mockReset();
    mockAcceptInvite.mockReset();
    mockUseAuth.mockReset();
    mockUseBoardEditor.mockReset();
    mockSaveInvitedBoard.mockReset();
    mockGetInvitedBoard.mockReset();
    mockGetInvitedBoard.mockResolvedValue(null);

    mockUseBoardEditor.mockReturnValue({
      state: { meta: { name: 'Board A' }, selectedObjectIds: [], viewport: { x: 0, y: 0, zoom: 1 } },
      boardTypeDef: { id: 'advanced' },
      activeTool: { id: 'select' },
      toolbox: [],
      setBoardType: jest.fn(),
      activeToolInstanceId: 'select',
      setActiveToolInstanceId: jest.fn(),
      strokeColor: '#000000',
      setStrokeColor: jest.fn(),
      strokeWidth: 2,
      updateStrokeWidth: jest.fn(),
      toolProps: {},
      updateActiveToolProp: jest.fn(),
      canvasEl: null,
      setCanvasEl: jest.fn(),
      fileInputRef: { current: null },
      handleCreateObject: jest.fn(),
      handleSelectionChange: jest.fn(),
      handleUpdateObject: jest.fn(),
      handleTransientObjectPatch: jest.fn(),
      handleDeleteSelection: jest.fn(),
      handleViewportChange: jest.fn(),
      zoomPercent: 100,
      handleZoomChange: jest.fn(),
      handleFitView: jest.fn(),
      handleExportJson: jest.fn(),
      handleExportPng: jest.fn(),
      handleImportClick: jest.fn(),
      handleImportFileChange: jest.fn(),
      selectedObjects: [],
      updateSelectionProp: jest.fn(),
      canUndo: false,
      canRedo: false,
      undo: jest.fn(),
      redo: jest.fn(),
      hasClipboard: false,
      copySelectionToClipboard: jest.fn(),
      pasteFromClipboard: jest.fn(),
      collab: { enabled: false, status: 'disabled', users: [], selfUserId: null, presenceByUserId: {} },
      isReadOnly: false,
      handleCursorWorldMove: jest.fn(),
    });
  });

  test('guest invite workflow validates, persists invite access and reaches the editor shell with the invite token preserved', async () => {
    mockUseAuth.mockReturnValue({
      configured: true,
      authenticated: false,
      accessToken: null,
      displayName: null,
      subject: null,
      login: jest.fn(),
      logout: jest.fn(),
      refreshFromStorage: jest.fn(),
    });

    mockValidateInvite.mockResolvedValue({
      valid: true,
      boardId: 'b-1',
      permission: 'viewer',
      expiresAt: '2026-03-08T10:00:00Z',
    });

    renderAt('http://localhost/board/b-1?invite=guest-token-1');

    expect(screen.getByText('Invite choice gate')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Continue as guest'));

    await waitFor(() => expect(mockValidateInvite).toHaveBeenCalledWith('guest-token-1'));
    await waitFor(() => expect(screen.getByTestId('board-editor-shell')).toBeInTheDocument());
    expect(screen.getByTestId('shell-invite-token')).toHaveTextContent('guest-token-1');
    expect(mockAcceptInvite).not.toHaveBeenCalled();
    expect(mockSaveInvitedBoard).toHaveBeenCalledWith(expect.objectContaining({
      boardId: 'b-1',
      inviteToken: 'guest-token-1',
      permission: 'viewer',
      expiresAt: '2026-03-08T10:00:00Z',
    }));
  });


  test('guest re-entry without an invite query reuses stored invited-board access metadata', async () => {
    mockUseAuth.mockReturnValue({
      configured: true,
      authenticated: false,
      accessToken: null,
      displayName: null,
      subject: null,
      login: jest.fn(),
      logout: jest.fn(),
      refreshFromStorage: jest.fn(),
    });
    mockGetInvitedBoard.mockResolvedValue({
      boardId: 'b-3',
      title: 'Saved invite board',
      inviteToken: 'stored-token-3',
      permission: 'viewer',
      expiresAt: '2026-03-08T10:00:00Z',
      lastOpenedAt: '2026-03-07T10:00:00Z',
    });
    mockValidateInvite.mockResolvedValue({
      valid: true,
      boardId: 'b-3',
      permission: 'viewer',
      expiresAt: '2026-03-08T10:00:00Z',
    });

    renderAt('http://localhost/board/b-3');

    await waitFor(() => expect(mockGetInvitedBoard).toHaveBeenCalledWith('b-3'));
    await waitFor(() => expect(mockValidateInvite).toHaveBeenCalledWith('stored-token-3'));
    await waitFor(() => expect(screen.getByTestId('board-editor-shell')).toBeInTheDocument());

    expect(screen.queryByText('Invite choice gate')).not.toBeInTheDocument();
    expect(screen.getByTestId('shell-invite-token')).toHaveTextContent('stored-token-3');
    expect(mockAcceptInvite).not.toHaveBeenCalled();
    expect(mockSaveInvitedBoard).toHaveBeenCalledWith(
      expect.objectContaining({
        boardId: 'b-3',
        inviteToken: 'stored-token-3',
        permission: 'viewer',
      })
    );
  });

  test('authenticated invite workflow validates, accepts, strips the query token and opens the editor shell', async () => {
    mockValidateInvite.mockResolvedValue({
      valid: true,
      boardId: 'b-2',
      permission: 'editor',
      expiresAt: '2026-03-08T10:00:00Z',
    });
    mockAcceptInvite.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      configured: true,
      authenticated: true,
      accessToken: 'token-123',
      displayName: 'Alice',
      subject: 'alice-1',
      login: jest.fn(),
      logout: jest.fn(),
      refreshFromStorage: jest.fn(),
    });

    renderAt('http://localhost/board/b-2?invite=auth-token-2');

    expect(screen.getByText('Invite acceptance gate')).toBeInTheDocument();

    await waitFor(() => expect(mockValidateInvite).toHaveBeenCalledWith('auth-token-2'));
    await waitFor(() => expect(mockAcceptInvite).toHaveBeenCalledWith('auth-token-2'));
    await waitFor(() => expect(screen.getByTestId('board-editor-shell')).toBeInTheDocument());

    expect(screen.getByTestId('shell-invite-token')).toHaveTextContent('');
    expect(screen.getByTestId('shell-invite-accepted')).toHaveTextContent('true');
    expect(window.location.search).toBe('');
    expect(mockSaveInvitedBoard).toHaveBeenCalledWith(expect.objectContaining({
      boardId: 'b-2',
      inviteToken: 'auth-token-2',
      permission: 'editor',
      expiresAt: '2026-03-08T10:00:00Z',
    }));
  });
});
