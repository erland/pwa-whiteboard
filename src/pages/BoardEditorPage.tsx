import React from 'react';
import { useParams, Link } from 'react-router-dom';

export const BoardEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

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
      </div>
    </section>
  );
};
