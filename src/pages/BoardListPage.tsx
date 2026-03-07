import React from 'react';
import { useNavigate } from 'react-router-dom';
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

      {model.loadState === 'loaded' && model.boards.length === 0 && (
        <p>You have no boards yet. Click “New board” to create your first one.</p>
      )}

      {model.boards.length > 0 && (
        <BoardList
          boards={model.boards}
          onOpen={model.openBoard}
          onDuplicate={model.handleDuplicateBoard}
          onRename={model.handleRenameBoard}
          onDelete={model.handleDeleteBoard}
        />
      )}
    </section>
  );
};
