declare global {
  // Injected at runtime in src/main.tsx from Vite's import.meta.env
  // Jest tests don't import main.tsx, so these will be undefined during tests.
  // That's fine: collaboration stays disabled unless both are present.
  var __VITE_SUPABASE_URL: string | undefined;
  var __VITE_SUPABASE_ANON_KEY: string | undefined;
  var __VITE_COLLAB_BASE_URL: string | undefined;
}

export {};
