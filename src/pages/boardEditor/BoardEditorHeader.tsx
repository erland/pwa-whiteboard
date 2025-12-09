import React from 'react';
import { Link } from 'react-router-dom';

type BoardEditorHeaderProps = {
  boardId?: string;
};

export const BoardEditorHeader: React.FC<BoardEditorHeaderProps> = ({ boardId }) => (
  <header className="page-header">
    <h1>Board editor</h1>
    <div className="page-header-actions">
      <span className="page-subtitle">Board ID: {boardId}</span>
      <Link to="/">← Back to boards</Link>
    </div>
  </header>
);