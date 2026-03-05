declare global {
  // Injected at runtime in src/main.tsx from Vite's import.meta.env.
  // Jest tests don't import main.tsx, so these will be undefined during tests.
  // That's fine: server-backed features stay disabled unless configured.
  var __VITE_API_BASE_URL: string | undefined;
  var __VITE_WS_BASE_URL: string | undefined;

  // Legacy (kept for backward compatibility)
  var __VITE_WHITEBOARD_SERVER_BASE_URL: string | undefined;

  var __VITE_BASE_URL: string | undefined;
}

export {};
