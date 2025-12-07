import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWhiteboard } from '../whiteboard/WhiteboardStore';
import type { WhiteboardMeta } from '../domain/types';

export const BoardEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { state, resetBoard } = useWhiteboard();

  useEffect(() => {
    if (!id) return;

    if (!state || state.meta.id !== id) {
      const now = new Date().toISOString();
      const meta: WhiteboardMeta = {
        id,
        name: `Board ${id}`,
        createdAt: now,
        updatedAt: now
      };
      resetBoard(meta);
    }
  }, [id, state, resetBoard]);

  return (
    <section className="page page-board-editor">
      <header className="page-header">
        <h1>Board editor</h1>
        <div className="page-header-actions">
          <span className="page-subtitle">Board ID: {id}</span>
          <Link to="/">← Back to boards</Link>
        </div>
      </header>
      <div className="board-editor-placeholder">
        <p>
          This is a placeholder for the whiteboard editor. In upcoming steps, this area will contain the drawing
          surface, toolbars, and properties panel.
        </p>
        {state && (
          <p>
            <strong>Debug:</strong> Board <code>{state.meta.name}</code> currently has{' '}
            <code>{state.objects.length}</code> objects.
          </p>
        )}
      </div>
    </section>
  );
};
