import type { WhiteboardMeta, BoardTypeId } from '../../domain/types';
import { BOARD_TYPE_IDS } from '../../whiteboard/boardTypes';

export type ImportedBoardPayload = {
  objects: unknown[];
  viewport?: unknown;
  meta?: Partial<WhiteboardMeta>;
};

export type ParsedBoardImport = {
  suggestedName: string;
  suggestedType: BoardTypeId;
  payload: ImportedBoardPayload;
};

export async function parseBoardImportFile(file: File): Promise<ParsedBoardImport> {
  const text = await file.text();
  const data: any = JSON.parse(text);

  if (!data || typeof data !== 'object') throw new Error('Invalid JSON');
  if (!Array.isArray(data.objects)) throw new Error('File does not contain a valid objects array');

  const importedMeta = (data.meta ?? {}) as Partial<WhiteboardMeta>;

  const suggestedName =
    typeof importedMeta.name === 'string' && importedMeta.name.trim()
      ? `${importedMeta.name.trim()} (import)`
      : 'Imported board';

  const suggestedType: BoardTypeId =
    typeof importedMeta.boardType === 'string' && (BOARD_TYPE_IDS as readonly string[]).includes(importedMeta.boardType)
      ? (importedMeta.boardType as BoardTypeId)
      : 'advanced';

  return {
    suggestedName,
    suggestedType,
    payload: {
      objects: data.objects as unknown[],
      viewport: data.viewport,
      meta: importedMeta,
    },
  };
}
