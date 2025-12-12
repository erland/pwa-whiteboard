import React from 'react';
import { Link } from 'react-router-dom';

type BoardEditorHeaderProps = {
  boardName?: string;
};

export const BoardEditorHeader: React.FC<BoardEditorHeaderProps> = ({
  boardName,
}) => (
  <header className="page-header board-editor-header">
    <div className="board-header-main">
      <h1 className="board-header-title">
        {boardName || 'Untitled board'}
      </h1>
    </div>
  </header>
);