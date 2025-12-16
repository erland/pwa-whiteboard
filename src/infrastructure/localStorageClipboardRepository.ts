// src/infrastructure/localStorageClipboardRepository.ts

import type { WhiteboardClipboardV1 } from '../domain/types';

const CLIPBOARD_KEY = 'pwa-whiteboard.clipboard.v1';

export interface ClipboardRepository {
  loadClipboard: () => WhiteboardClipboardV1 | null;
  saveClipboard: (clipboard: WhiteboardClipboardV1 | null) => void;
  clearClipboard: () => void;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function isClipboardV1(v: unknown): v is WhiteboardClipboardV1 {
  if (!isRecord(v)) return false;
  if ((v as any).version !== 1) return false;
  if (typeof (v as any).sourceBoardId !== 'string') return false;
  if (typeof (v as any).copiedAt !== 'string') return false;
  if (!Array.isArray((v as any).objects)) return false;
  const b = (v as any).bounds;
  if (!isRecord(b)) return false;
  if (typeof (b as any).x !== 'number') return false;
  if (typeof (b as any).y !== 'number') return false;
  if (typeof (b as any).width !== 'number') return false;
  if (typeof (b as any).height !== 'number') return false;
  return true;
}

export function getClipboardRepository(): ClipboardRepository {
  return {
    loadClipboard: () => {
      try {
        const raw = localStorage.getItem(CLIPBOARD_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return isClipboardV1(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },

    saveClipboard: (clipboard) => {
      try {
        if (!clipboard) {
          localStorage.removeItem(CLIPBOARD_KEY);
          return;
        }
        localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(clipboard));
      } catch (err) {
        // LocalStorage can fail (quota, private mode, etc.). Clipboard is best-effort.
        console.warn('Failed to persist clipboard', err);
      }
    },

    clearClipboard: () => {
      try {
        localStorage.removeItem(CLIPBOARD_KEY);
      } catch {
        // ignore
      }
    },
  };
}
