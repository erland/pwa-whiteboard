/// <reference types="vite/client" />

declare interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_WS_BASE_URL?: string;

  /** Legacy (prefer VITE_API_BASE_URL) */
  readonly VITE_WHITEBOARD_SERVER_BASE_URL?: string;
}
