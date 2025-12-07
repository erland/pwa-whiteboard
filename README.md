# PWA Whiteboard – Step 1 (Bootstrap & PWA Skeleton)

This is the initial project skeleton for the **PWA Whiteboard** application.

## What is included

- React + TypeScript app bootstrapped with Vite
- Basic routing with a board list page and a board editor placeholder
- PWA setup:
  - `manifest.webmanifest`
  - Simple service worker (`public/sw.js`) for basic offline caching
- Jest + Testing Library configured for unit and component tests
- GitHub Pages–ready configuration (`vite.config.ts` with `base: '/pwa-whiteboard/'` and a `deploy` script)

## Scripts

- `npm install` – install dependencies
- `npm run dev` – start development server
- `npm run build` – build for production
- `npm run preview` – preview the production build
- `npm test` – run Jest test suite
- `npm run deploy` – deploy the `dist` folder to GitHub Pages using the `gh-pages` branch

## GitHub Pages

1. Create a repository named `pwa-whiteboard` on GitHub.
2. Push this project to that repository.
3. Run:

   ```bash
   npm install
   npm run build
   npm run deploy
   ```

4. In the GitHub repository settings, configure GitHub Pages to serve from the `gh-pages` branch.
5. The app will be available at:

   ```text
   https://<your-username>.github.io/pwa-whiteboard/
   ```

Replace the placeholder icons in `public/icons/` with real PNG files before going live.
