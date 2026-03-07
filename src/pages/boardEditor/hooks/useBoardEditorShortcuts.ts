import { useEffect } from 'react';

export type UseBoardEditorShortcutsArgs = {
  isReadOnly: boolean;
  canCopy: boolean;
  canPaste: boolean;
  onDeleteSelection: () => void;
  onCopy: () => void;
  onPaste: () => void;
};

function shouldIgnoreShortcutTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if ((el as any).isContentEditable) return true;
  const tag = el.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

export function useBoardEditorShortcuts({
  isReadOnly,
  canCopy,
  canPaste,
  onDeleteSelection,
  onCopy,
  onPaste,
}: UseBoardEditorShortcutsArgs) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnoreShortcutTarget(e.target)) return;

      const keyRaw = e.key;

      if (keyRaw === 'Backspace' || keyRaw === 'Delete') {
        if (isReadOnly || !canCopy) return;
        e.preventDefault();
        onDeleteSelection();
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      const key = keyRaw.toLowerCase();
      if (key === 'c') {
        if (!canCopy) return;
        e.preventDefault();
        onCopy();
        return;
      }
      if (key === 'v') {
        if (isReadOnly || !canPaste) return;
        e.preventDefault();
        onPaste();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isReadOnly, canCopy, canPaste, onDeleteSelection, onCopy, onPaste]);
}
