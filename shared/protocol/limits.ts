/**
 * Protocol-level limits.
 *
 * These are intentionally conservative defaults for an MVP.
 * The backend should enforce them and return an error when exceeded.
 */

// WebSocket message limit for our app-level protocol (bytes).
// Note: upstream platforms may impose their own limits too.
export const MAX_MESSAGE_BYTES = 64 * 1024; // 64 KiB

// Identifiers
export const MAX_BOARD_ID_CHARS = 128;
export const MAX_USER_ID_CHARS = 128;
export const MAX_CLIENT_OP_ID_CHARS = 128;

// Invite tokens / auth tokens can be relatively long (JWTs, etc.).
// Keep it bounded to avoid accidental megabyte payloads.
export const MAX_TOKEN_CHARS = 4096;

// Presence
export const MAX_DISPLAY_NAME_CHARS = 64;
export const MAX_COLOR_CHARS = 32;
export const MAX_SELECTION_IDS = 200;

// Content-ish limits (these are *protocol* limits; domain may be stricter later).
export const MAX_TEXT_CHARS = 10_000;
export const MAX_STROKE_POINTS = 50_000;
