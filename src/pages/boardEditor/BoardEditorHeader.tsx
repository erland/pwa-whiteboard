import React from 'react';

type BoardEditorHeaderProps = {
  boardName?: string;
  canCopy?: boolean;
  canPaste?: boolean;
  onCopy?: () => void;
  onPaste?: () => void;
};

export const BoardEditorHeader: React.FC<BoardEditorHeaderProps> = ({
  boardName,
  canCopy,
  canPaste,
  onCopy,
  onPaste,
}) => (
  <header className="page-header board-editor-header">
    <div className="board-header-main">
      <h1 className="board-header-title">
        {boardName || 'Untitled board'}
      </h1>
    </div>

    <div className="page-header-actions" aria-label="Clipboard actions">
      <button
        type="button"
        className="tool-button"
        onClick={onCopy}
        disabled={!canCopy}
        title="Copy (Ctrl/Cmd+C)"
      >
        ⧉ Copy
      </button>
      <button
        type="button"
        className="tool-button"
        onClick={onPaste}
        disabled={!canPaste}
        title="Paste (Ctrl/Cmd+V)"
      >
        ⎘ Paste
      </button>
    </div>
  </header>
);