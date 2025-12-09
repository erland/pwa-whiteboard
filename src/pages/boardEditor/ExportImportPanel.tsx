import React from 'react';

type ExportImportPanelProps = {
  canExport: boolean;
  onExportJson: () => void;
  onExportPng: () => void;
  onImportClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onImportFileChange: React.ChangeEventHandler<HTMLInputElement>;
};

export const ExportImportPanel: React.FC<ExportImportPanelProps> = ({
  canExport,
  onExportJson,
  onExportPng,
  onImportClick,
  fileInputRef,
  onImportFileChange
}) => (
  <div className="panel">
    <h2 className="panel-title">Export &amp; Import</h2>
    <div className="panel-row">
      <button
        type="button"
        className="tool-button"
        onClick={onExportJson}
        disabled={!canExport}
      >
        Export board (JSON)
      </button>
    </div>
    <div className="panel-row">
      <button
        type="button"
        className="tool-button"
        onClick={onExportPng}
        disabled={!canExport}
      >
        Export view (PNG)
      </button>
    </div>
    <div className="panel-row">
      <button
        type="button"
        className="tool-button"
        onClick={onImportClick}
      >
        Import board (JSON)
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={onImportFileChange}
      />
    </div>
  </div>
);