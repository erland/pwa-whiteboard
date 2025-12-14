// src/pages/hooks/useBoardImportExport.ts
import React, { useRef } from 'react';
import type {
  WhiteboardMeta,
  WhiteboardObject,
  BoardEvent,
  Viewport
} from '../../domain/types';
import { generateEventId } from './boardEvents';

type WhiteboardStateForExport = {
  meta: WhiteboardMeta;
  objects: WhiteboardObject[];
  viewport: Viewport;
};

type UseBoardImportExportArgs = {
  state: (WhiteboardStateForExport & { history?: any; selectedObjectIds?: string[] }) | null;
  canvasEl: HTMLCanvasElement | null;
  resetBoard: (metaOrState: any) => void;
  dispatchEvent: (event: BoardEvent) => void;
  setViewport: (patch: Partial<Viewport>) => void;
};

export function useBoardImportExport({
  state,
  canvasEl,
  resetBoard,
  dispatchEvent,
  setViewport
}: UseBoardImportExportArgs) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExportJson = () => {
    if (!state) return;
    const exportData = {
      version: 1,
      boardId: state.meta.id,
      meta: state.meta,
      objects: state.objects,
      viewport: state.viewport
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const safeName = state.meta.name?.replace(/[^a-z0-9_-]+/gi, '_') || 'whiteboard';
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.whiteboard.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPng = () => {
    if (!canvasEl || !state) return;
    try {
      const dataUrl = canvasEl.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      const safeName = state.meta.name?.replace(/[^a-z0-9_-]+/gi, '_') || 'whiteboard';
      a.download = `${safeName}.png`;
      a.click();
    } catch (err) {
      console.error('Failed to export PNG', err);
      window.alert('Could not export image. See console for details.');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !state) {
      return;
    }
    try {
      const text = await file.text();
      const data: any = JSON.parse(text);

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid JSON');
      }
      if (!Array.isArray(data.objects)) {
        throw new Error('File does not contain a valid objects array');
      }

      const now = new Date().toISOString();
      const importedMeta = (data.meta ?? {}) as Partial<WhiteboardMeta>;
      const newMeta: WhiteboardMeta = {
        ...state.meta,
        ...importedMeta,
        boardType:
          (importedMeta as any).boardType ?? state.meta.boardType ?? 'advanced',
        id: state.meta.id,
        updatedAt: now
      };

      // Reset board meta
      resetBoard(newMeta);

      // Recreate objects from imported file
      const objects = data.objects as WhiteboardObject[];
      const boardId = newMeta.id;

      for (const obj of objects) {
        const event: BoardEvent = {
          id: generateEventId(),
          boardId,
          type: 'objectCreated',
          timestamp: now,
          payload: { object: obj }
        } as BoardEvent;
        dispatchEvent(event);
      }

      // Restore viewport if present
      if (data.viewport) {
        const vp = data.viewport as Viewport;
        setViewport(vp);
      }

      window.alert('Board imported successfully.');
    } catch (err) {
      console.error('Failed to import board', err);
      window.alert('Could not import board JSON. Please check the file format.');
    } finally {
      e.target.value = '';
    }
  };

  return {
    fileInputRef,
    handleExportJson,
    handleExportPng,
    handleImportClick,
    handleImportFileChange
  };
}