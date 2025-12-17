import React, { useRef } from 'react';

type Props = {
  title: string;
  onNewBoard: () => void;
  onImportFile: (file: File) => void;
};

export const BoardListHeader: React.FC<Props> = ({ title, onNewBoard, onImportFile }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onImportFile(file);

    // Allow selecting the same file again.
    e.target.value = '';
  };

  return (
    <header className="page-header">
      <h1>{title}</h1>
      <div className="page-header-actions">
        <button type="button" onClick={handleImportClick}>
          Import
        </button>
        <button type="button" onClick={onNewBoard}>
          + New board
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    </header>
  );
};
