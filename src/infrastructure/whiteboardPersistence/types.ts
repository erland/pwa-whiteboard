import type { WhiteboardMeta } from '../../domain/types';

export const BOARD_STATE_PREFIX = 'pwa-whiteboard.board.';
export const PERSIST_SCHEMA_VERSION = 2 as const;
export const FREEHAND_POINTS_SCALE = 10;

export type PersistedBoardStateV2 = {
  schemaVersion: typeof PERSIST_SCHEMA_VERSION;
  meta: WhiteboardMeta;
  objects: any[];
  selectedObjectIds: any[];
  viewport: any;
};
