import React from 'react';
import { isWhiteboardServerConfigured } from '../config/server';
import { useNavigate } from 'react-router-dom';
import { createPublicationsApi } from '../api/publicationsApi';
import { useAuth } from '../auth/AuthContext';
import { getBoardType } from '../whiteboard/boardTypes';
import { BoardListHeader } from './boardList/components/BoardListHeader';
import { CreateBoardModal } from './boardList/components/CreateBoardModal';
import { ImportBoardModal } from './boardList/components/ImportBoardModal';
import { BoardList } from './boardList/components/BoardList';
import { useBoardListPageModel } from './boardList/useBoardListPageModel';

export const BoardListPage: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const model = useBoardListPageModel(auth, navigate);
  const serverConfigured = isWhiteboardServerConfigured();

  const hasLocalDraftsInServerMode = serverConfigured && model.boardSections.some((section) => section.id === 'local');

  const [publicationRedirectState, setPublicationRedirectState] = React.useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });

  React.useEffect(() => {
    if (typeof window === 'undefined' || !serverConfigured) return;
    let cancelled = false;
    let token: string | null = null;
    try {
      const url = new URL(window.location.href);
      token = url.searchParams.get('publication')?.trim() || null;
    } catch {
      token = null;
    }
    if (!token) return;

    setPublicationRedirectState({ loading: true, error: null });
    createPublicationsApi()
      .resolve(token)
      .then((publication) => {
        if (cancelled) return;
        navigate(`/board/${encodeURIComponent(publication.boardId)}?publication=${encodeURIComponent(token!)}`, { replace: true });
      })
      .catch((e: any) => {
        if (cancelled) return;
        setPublicationRedirectState({ loading: false, error: e?.message ? String(e.message) : 'Failed to open publication link.' });
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, serverConfigured]);

  if (publicationRedirectState.loading) {
    return <section className="page page-board-list"><p>Opening publication…</p></section>;
  }

  if (publicationRedirectState.error) {
    return <section className="page page-board-list"><p className="error-text">Publication error: {publicationRedirectState.error}</p></section>;
  }

  return (
    <section className="page page-board-list">
      <BoardListHeader
        title="Your Boards"
        onNewBoard={model.openCreateDialog}
        onImportFile={model.handleImportFile}
      />

      <CreateBoardModal
        isOpen={model.isCreateOpen}
        isBusy={model.isCreating}
        name={model.createName}
        boardType={model.createType}
        boardTypeOptions={model.boardTypeOptions}
        onNameChange={model.setCreateName}
        onBoardTypeChange={model.setCreateType}
        onCancel={model.closeCreateDialog}
        onConfirm={model.handleCreateBoard}
      />

      <ImportBoardModal
        isOpen={model.isImportOpen}
        isBusy={model.isImporting}
        name={model.importName}
        boardTypeLabel={getBoardType(model.importType).label}
        onNameChange={model.setImportName}
        onCancel={model.closeImportDialog}
        onConfirm={model.handleConfirmImport}
      />

      {model.loadState === 'loading' && <p>Loading boards…</p>}
      {model.loadState === 'error' && (
        <div>
          <p className="error-text">{model.error}</p>
          {model.needsAuth && auth.configured && (
            <button className="primary" onClick={model.handleSignIn} style={{ marginTop: 12 }}>
              Sign in
            </button>
          )}
        </div>
      )}

      {model.loadState === 'loaded' && model.boardSections.length === 0 && (
        <p>
          {serverConfigured
            ? 'No boards are available yet. Sign in to see your boards, or open an invite link to access a shared board.'
            : 'You have no boards yet. Click “New board” to create your first one.'}
        </p>
      )}

      {hasLocalDraftsInServerMode && (
        <p className="board-list-note">
          Local drafts stay in this browser and are not uploaded to the server automatically.
        </p>
      )}

      {model.boardSections.length > 0 && (
        <div className="board-list-sections">
          {model.boardSections.map((section) => (
            <section
              key={section.id}
              className="board-list-section"
              aria-labelledby={`board-list-section-${section.id}`}
            >
              <header className="board-list-section-header">
                <h2 id={`board-list-section-${section.id}`} className="board-list-section-title">
                  {section.title}
                </h2>
              </header>
              <BoardList
                items={section.items}
                onOpen={model.openBoard}
                onDuplicate={model.handleDuplicateBoard}
                onRename={model.handleRenameBoard}
                onDelete={model.handleDeleteBoard}
              />
            </section>
          ))}
        </div>
      )}
    </section>
  );
};
