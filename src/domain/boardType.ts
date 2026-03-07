import type { BoardTypeId } from './types';

/**
 * Canonical client-side board type semantics.
 *
 * End state decision for the current client/server split:
 * - `boardType` is a client/domain concept and is authoritative in `WhiteboardMeta`
 *   and persisted snapshots/state.
 * - the Java server's `board.type` field is treated as a coarse server-side kind/
 *   transport discriminator, not as the editor policy type.
 * - until the server exposes a first-class boardType field, the REST read model may
 *   cache boardType locally for faster board-list rendering in the same browser.
 */
export const DEFAULT_BOARD_TYPE: BoardTypeId = 'advanced';

/**
 * Coarse server board kind used by the current Java server contract.
 * This is intentionally not the same concept as the richer client boardType.
 */
export const SERVER_WHITEBOARD_KIND = 'whiteboard' as const;

export function isBoardType(value: unknown): value is BoardTypeId {
  return value === 'advanced' || value === 'freehand' || value === 'mindmap';
}

export function coerceBoardType(value: unknown): BoardTypeId {
  return isBoardType(value) ? value : DEFAULT_BOARD_TYPE;
}
