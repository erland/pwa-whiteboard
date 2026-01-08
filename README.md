# PWA Whiteboard – Version 1 (Local Single–User)

This repository contains a **Progressive Web App (PWA) whiteboard** built with React + TypeScript.
Version 1 is focused on a **single local user** with a clean architecture that can be extended to
multi–user collaboration in later versions.

---

## Features in Version 1

- **Board list page**
  - Lists locally stored boards (via `localStorage`)
  - Create new boards with generated IDs
  - Navigate into an individual board editor

- **Board editor**
  - Freehand drawing
  - Basic shapes: rectangles & ellipses
  - Text labels
  - Sticky notes
  - Selection tool for:
    - Selecting shapes/notes
    - Dragging them around
    - Deleting selection
    - Applying stroke (color + width) to selection
  - Basic object model and event history per board

- **View navigation & history**
  - Pan the board by dragging empty space (with Select tool)
  - Zoom in/out via slider
  - Reset view button
  - Undo/redo stack based on event history (create/update/delete/selection)

- **Export / Import**
  - Export board as **JSON** (`*.whiteboard.json`) including:
    - metadata
    - objects
    - viewport
  - Import board from JSON into the current board
  - Export the current **view as PNG**

- **PWA features**
  - Web app manifest
  - Basic service worker for offline caching
  - Installable on supporting browsers/devices

- **Architecture**
  - Domain model for whiteboard objects & events
  - `WhiteboardStore` React context for state + history
  - `localStorageBoardsRepository` for a simple local index of boards
  - Designed to be extended with a real backend and multi–user sync later

---

## Getting started (local development)

Requirements:

- Node.js 18+ (20 recommended)
- npm

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

By default Vite runs on `http://localhost:5173/`. The app assumes it will eventually
be served under `/pwa-whiteboard/` in production (see `vite.config.ts`).

---

## Testing

This project uses **Jest** + **React Testing Library** for unit and UI tests.

Run the full test suite:

```bash
npm test
```

The most relevant tests are:

- `src/App.test.tsx` – verifies that the main app loads and the board list heading appears.
- `src/domain/__tests__/whiteboardState.test.ts` – unit tests for the domain state and reducer logic.
- `src/infrastructure/__tests__/localStorageBoardsRepository.test.ts` – tests the localStorage-backed boards index.

When adding new features, prefer to:

1. Add/extend **domain tests** in `src/domain/__tests__/` for pure logic.
2. Add **component tests** in `src/` or `src/pages/__tests__/` for UI behavior that is important to keep stable.

---

## Build

To produce a production build:

```bash
npm run build
```

The compiled static site is output to the `dist/` directory. The `vite.config.ts` file
sets `base: '/pwa-whiteboard/'` so that the app works when served at:

```text
https://<your-username>.github.io/pwa-whiteboard/
```

---

## Deployment to GitHub Pages

You have two options for deploying to GitHub Pages:

### 1. Local manual deploy (using `gh-pages`)

A local deployment script is configured in `package.json`:

```jsonc
{
  "scripts": {
    "deploy": "gh-pages -d dist"
  }
}
```

You can manually deploy from your machine like this:

```bash
npm install
npm run build
npm run deploy
```

Then in your GitHub repository settings, configure **GitHub Pages** to serve from
the `gh-pages` branch. The app will be available at:

```text
https://<your-username>.github.io/pwa-whiteboard/
```

This is useful if you prefer to keep CI simple and only publish when you decide to.

### 2. GitHub Actions workflow (manual or on release)

A workflow is provided in:

```text
.github/workflows/deploy.yml
```

It is configured to:

- Run on **manual trigger** (`workflow_dispatch`), and
- Automatically run when a **GitHub Release is published** (`release: published`).
- Install dependencies, run tests, build the app.
- Upload the `dist/` folder as a Pages artifact.
- Deploy that artifact to GitHub Pages using `actions/deploy-pages`.

To use this approach:

1. In your GitHub repository, go to **Settings → Pages**.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Push this workflow file to the default branch.
4. Trigger the workflow:
   - Manually from the **Actions** tab (select “Deploy PWA Whiteboard to GitHub Pages” → “Run workflow”), or
   - Create/publish a GitHub Release.

GitHub Pages will then serve the site at:

```text
https://<your-username>.github.io/pwa-whiteboard/
```

(For a user named `erland`, that would be `https://erland.github.io/pwa-whiteboard/`.)

---

## Future directions

Version 1 is intentionally single–user and local only, but the structure is designed
so that later versions can add:

- Real backend (e.g. REST/WebSocket) for multi–user boards.
- Authentication & authorization.
- Real–time collaboration and presence.
- Server–side persistence of boards and events.
- Per–board sharing/permissions.

Those later steps can reuse the event model and most of the UI, while replacing
the local repository with one that talks to a backend and syncs events between clients.


---

## Collaboration and sharing (optional)

The app can run fully **local-only** (boards stored in `localStorage`). If you configure Supabase + the worker,
it can also support **real-time collaboration** and **share links**.

### Viewer/editor invite links (Option A: hash-only tokens)

Board owners can create multiple invite links with a role:

- **Viewer**: can view the board
- **Editor**: can edit the board

For security, the raw invite token is **never stored** in the database — only a SHA-256 `token_hash` is stored.
That means an invite URL is **only shown once at creation**. If you lose it, use **Regenerate link** to revoke the
old invite and create a new one.

Invites can also have an optional **label** to help you manage multiple links (e.g. “Team A (editor)”).

### When collaboration connects

- If you are **signed in** as the owner, collaboration connects automatically on the board page.
- If you open a board with an **invite link**, collaboration connects using that invite (sign-in not required).
- Otherwise, the board works in **local-only** mode without showing “Connecting…” overlays.


## Manual QA checklist (invite management)

Suggested quick checks after changes:

- Create multiple invites (both viewer and editor) and verify they appear in the list.
- Toggle “Show revoked/expired” and verify filtering works.
- Revoke an invite and confirm it becomes unusable.
- Extend an expired invite and confirm it becomes usable again.
- Regenerate an invite and confirm:
  - old invite is revoked
  - a new invite row is created
  - the new one-time link works
- Sign in while a board is open and confirm collaboration connects without re-opening the board.

