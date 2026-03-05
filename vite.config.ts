import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

function normalizeBase(base: string): string {
  if (!base) return '/';
  // Ensure leading slash
  if (!base.startsWith('/')) base = '/' + base;
  // Ensure trailing slash
  if (!base.endsWith('/')) base = base + '/';
  return base;
}

const base = normalizeBase(process.env.VITE_PUBLIC_BASE || '/pwa-whiteboard/');

export default defineConfig({
  plugins: [react()],
  base
});
