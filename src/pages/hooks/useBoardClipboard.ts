// src/pages/hooks/useBoardClipboard.ts
export type UseBoardClipboardArgs = {
  clipboard: unknown;
  copySelectionToClipboard: () => void;
  pasteFromClipboard: (opts: { canvasWidth?: number; canvasHeight?: number }) => void;
  clearClipboard: () => void;
  canvasWidth?: number;
  canvasHeight?: number;
};

export function useBoardClipboard({
  clipboard,
  copySelectionToClipboard,
  pasteFromClipboard,
  clearClipboard,
  canvasWidth,
  canvasHeight,
}: UseBoardClipboardArgs) {
  const handleCopySelectionToClipboard = () => {
    copySelectionToClipboard();
  };

  const handlePasteFromClipboard = () => {
    pasteFromClipboard({
      canvasWidth,
      canvasHeight,
    });
  };

  const handleClearClipboard = () => {
    clearClipboard();
  };

  return {
    hasClipboard: !!clipboard,
    copySelectionToClipboard: handleCopySelectionToClipboard,
    pasteFromClipboard: handlePasteFromClipboard,
    clearClipboard: handleClearClipboard,
  };
}
