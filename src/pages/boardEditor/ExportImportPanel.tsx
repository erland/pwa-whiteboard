import React, { useState } from 'react';

type ExportImportPanelProps = {
  canExport: boolean;
  onExportJson: () => void;
  onExportPng: () => void;
  onImportClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onImportFileChange: React.ChangeEventHandler<HTMLInputElement>;
};

/**
 * Export & Import as an overlay dropdown menu.
 * Clicking the button toggles a floating menu that does not push
 * layout down.
 */
export const ExportImportPanel: React.FC<ExportImportPanelProps> = ({
  canExport,
  onExportJson,
  onExportPng,
  onImportClick,
  fileInputRef,
  onImportFileChange,
}) => {
  const [open, setOpen] = useState(false);

  const toggleMenu = () => {
    setOpen((prev) => !prev);
  };

  const handleExportJson = () => {
    onExportJson();
    setOpen(false);
  };

  const handleExportPng = () => {
    onExportPng();
    setOpen(false);
  };

  const handleImport = () => {
    onImportClick();
    // keep menu open or close? close feels nicer after action:
    setOpen(false);
  };

  return (
    <div className="panel export-panel">
      <div className="export-panel-header">
        <button
          type="button"
          className="tool-button export-panel-trigger"
          onClick={toggleMenu}
        >
          Export &amp; Import ▾
        </button>
      </div>

      {open && (
        <div className="export-panel-menu">
          <button
            type="button"
            className="tool-button"
            onClick={handleExportJson}
            disabled={!canExport}
          >
            Export board (JSON)
          </button>

          <button
            type="button"
            className="tool-button"
            onClick={handleExportPng}
            disabled={!canExport}
          >
            Export view (PNG)
          </button>

          <button
            type="button"
            className="tool-button"
            onClick={handleImport}
          >
            Import board (JSON)
          </button>

          {/* Hidden file input (same as before) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={onImportFileChange}
          />
        </div>
      )}
    </div>
  );
};