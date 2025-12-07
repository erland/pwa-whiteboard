# Development Plan – Digital Whiteboard PWA (Version 1)

Repository: `pwa-whiteboard`  
Tech stack: TypeScript, React, Jest, PWA, hosted on GitHub Pages  
(Other libraries/frameworks are suggestions and can be adjusted if needed.)

---

## Step 1 – Project Bootstrap & PWA Skeleton

**Goal:** Create a working PWA skeleton with React + TypeScript, basic routing, and GitHub Pages deployment.

**Scope:**

- Initialize the project structure:
  - Create repository `pwa-whiteboard`.
  - Set up React + TypeScript app (e.g., with Vite or similar build tool).
  - Configure Jest + Testing Library for unit and component tests.
- Basic app layout:
  - Top-level `App` component with:
    - Simple header (app name, navigation placeholder).
    - Main content area.
- PWA setup:
  - Add `manifest.webmanifest` with:
    - App name, short name
    - Icons (placeholder icons are fine in this step)
    - Display mode `standalone`
  - Register service worker for offline caching (via build tool/plugin or custom SW).
- Routing:
  - Set up basic routing, e.g.:
    - `/` – “Board list” page placeholder
    - `/board/:id` – “Board editor” page placeholder
- GitHub Pages deployment:
  - Configure project for deployment to GitHub Pages from the `main` or `gh-pages` branch.
  - Add a minimal README with build and deploy instructions.

**Acceptance criteria:**

- App builds and runs locally with TypeScript and React.
- Basic routing between board list and board editor pages works.
- App is installable as a PWA on a supporting browser.
- App is deployed and reachable via GitHub Pages under the `pwa-whiteboard` repository.

---

## Step 2 – Core Domain Model & State Management

**Goal:** Define the internal representations of whiteboard, objects, and events, and set up a state management layer for version 1.

**Scope:**

- Define TypeScript domain types:
  - `WhiteboardMeta` (id, name, createdAt, updatedAt).
  - `WhiteboardObject` (id, type, position, size, style, text, etc.).
  - `WhiteboardState` (collection of objects, viewport/zoom info, selection, etc.).
  - `BoardEvent` (object created/updated/deleted, with metadata like timestamp).
- Design an event-driven update function:
  - `applyEvent(state: WhiteboardState, event: BoardEvent): WhiteboardState`.
  - Ensure it supports basic v1 operations (create object, update object, delete object, select object).
- Global state management:
  - Introduce a simple store (e.g., React context + reducer) for the currently open board:
    - `WhiteboardProvider` + `useWhiteboard()` hook.
  - Include undo/redo stacks in the state structure (even if implementation comes in a later step).
- Board list model:
  - Define a lightweight `BoardsIndex` structure (list of `WhiteboardMeta`).
  - Provide an interface for a `BoardsRepository` abstraction (create, list, delete, rename).

**Acceptance criteria:**

- TypeScript interfaces/types defined for all core domain entities.
- A reducer or equivalent function applies board events to a `WhiteboardState`.
- There is a React context or similar that exposes the current board state and a `dispatchEvent` function to the UI.
- Static unit tests exist for domain functions (e.g., `applyEvent` behavior).

---

## Step 3 – Board List Page (Single-User, Local Only)

**Goal:** Implement the board list page for managing local whiteboards, backed by a simple local repository.

**Scope:**

- Implement `BoardsRepository` using browser storage (e.g., `localStorage` or IndexedDB via a small helper):
  - `listBoards(): Promise<BoardsIndex>`
  - `createBoard(name: string): Promise<WhiteboardMeta>`
  - `renameBoard(id: string, name: string): Promise<void>`
  - `deleteBoard(id: string): Promise<void>`
- Board list UI (`/` route):
  - Show a list of boards with:
    - Name
    - Last updated timestamp
  - Actions per board:
    - Open
    - Rename (inline edit or dialog)
    - Delete (with confirmation)
  - Global actions:
    - “Create new board”
- Navigation integration:
  - When a board is created, navigate to `/board/:id`.
  - When a board is deleted, the list updates immediately.
- Loading and error states:
  - Show a simple loading state while fetching boards.
  - Show a simple error message if listing/creating/deleting fails.

**Acceptance criteria:**

- The user can create, list, rename, and delete boards from the main page.
- Local storage persists the board index across sessions.
- Basic tests confirm repository behavior (mocked storage) and list rendering with sample data.

---

## Step 4 – Canvas & Basic Drawing (Freehand + Simple Shapes)

**Goal:** Implement the core whiteboard surface with support for freehand drawing and basic shapes, integrated with the domain model.

**Scope:**

- Board editor layout (`/board/:id`):
  - Tool sidebar (tools: select, freehand, rectangle, ellipse, text, sticky note placeholders).
  - Main canvas area for drawing.
  - Simple top bar (board name, back to list, export placeholder).
- Canvas implementation:
  - Implement a canvas component (e.g., HTML `<canvas>` or SVG-based) that:
    - Renders all `WhiteboardObject`s based on `WhiteboardState`.
    - Handles pointer/mouse events for:
      - Freehand drawing (stroke captured as polyline/series of points).
      - Creating rectangles and ellipses by drag (start/end coordinates).
  - Translate pointer events into `BoardEvent`s:
    - `ObjectCreated` events for finished strokes/shapes.
- Basic styling and coordinate system:
  - Coordinate system centered at the top-left of the board (0,0).
  - Maintain simple “logical” coordinates decoupled from zoom.
- Persistence of board content:
  - Create a `WhiteboardRepository` implementation in local storage:
    - `loadBoard(id: string): Promise<WhiteboardState>`
    - `saveBoard(id: string, state: WhiteboardState): Promise<void>`
  - Integrate with the editor so that:
    - When the board route is opened, it loads the board state.
    - Changes are saved automatically (e.g., debounced or after each event).

**Acceptance criteria:**

- User can open a board, draw freehand strokes, rectangles, and ellipses.
- Drawn content is visible when reopening the board.
- Board state is stored locally and persists across reloads.
- Core domain event flow is exercised end-to-end (UI → event → state → render).

---

## Step 5 – Selection, Editing, and Deletion of Objects

**Goal:** Allow users to select, move, resize, and delete objects, using the same event-based state model.

**Scope:**

- Selection mechanics:
  - Implement a selection tool:
    - Clicking on an object selects it.
    - Clicking on empty space clears selection.
    - Optional: drag-selection (marquee) for multiple objects.
- Move/drag objects:
  - When an object is selected, allow it to be dragged:
    - Pointer down on object → start drag.
    - Pointer move → update object position preview.
    - Pointer up → commit movement as a `ObjectUpdated` event.
- Resize objects:
  - Display resize handles for selected objects (rectangles/ellipses/sticky notes).
  - Dragging a handle emits `ObjectUpdated` events with new size.
- Delete objects:
  - Keyboard shortcut (e.g., Delete/Backspace) or toolbar button to remove selected objects (creates `ObjectDeleted` events).
- Visual feedback:
  - Highlight selected objects (e.g., outline or glow).
  - Show handles on selected objects where resize is supported.

**Acceptance criteria:**

- User can select single objects and move them on the board.
- User can resize basic shapes using handles.
- User can delete selected objects.
- State changes are persisted and correctly reloaded.
- Tests cover basic selection logic and event application for move/resize/delete.

---

## Step 6 – Text & Sticky Notes

**Goal:** Add support for text-based objects and sticky notes as described in the functional specification.

**Scope:**

- Object types:
  - Extend `WhiteboardObject` with:
    - `TextObject` (simple text label)
    - `StickyNoteObject` (rectangular box with text and fill color)
- Creating text objects:
  - Text tool:
    - Click on the board to create a new text object at that position.
    - Immediately focus an inline editor (overlay input or editable text) for entering text.
- Editing text:
  - When a text or sticky note object is selected:
    - Double-click (or specific action) to enter text edit mode.
    - Changes are committed as `ObjectUpdated` events.
- Sticky notes:
  - Sticky note tool:
    - Click to create a new sticky note at the clicked position.
    - Default size and color.
    - Same text editing behavior as text objects.
- Styling controls (basic):
  - Provide a minimal properties panel:
    - For selected text/sticky note objects:
      - Text size: small/medium/large.
      - Fill color (for sticky notes) from a small palette.

**Acceptance criteria:**

- User can create text labels and sticky notes.
- User can edit text content inline.
- User can adjust basic visual properties for text/sticky notes.
- All operations are represented as events and persisted correctly.
- Tests validate creation and update of text/sticky note objects in the domain layer.

---

## Step 7 – Undo/Redo & View Navigation (Pan/Zoom)

**Goal:** Implement undo/redo based on the event model, and add pan/zoom capabilities for navigating larger boards.

**Scope:**

- Undo/redo model:
  - Maintain two stacks in the state (or in the store):
    - `pastEvents` (applied events).
    - `futureEvents` (for redo).
  - Update event application logic so that:
    - Dispatching a new event pushes it onto `pastEvents` and clears `futureEvents`.
  - Implement functions:
    - `undo(state)` → revert last event (recompute state from remaining events).
    - `redo(state)` → reapply last undone event.
- UI controls:
  - Add undo/redo buttons in the top bar.
  - Optional keyboard shortcuts (Ctrl+Z / Ctrl+Y or Cmd+Z / Shift+Cmd+Z).
- Pan & zoom:
  - Track `viewport` in `WhiteboardState`:
    - `offsetX`, `offsetY`, `zoom`.
  - Implement panning:
    - Middle mouse button, space+drag, or two-finger drag (for touch).
  - Implement zoom:
    - Zoom in/out buttons.
    - Optional: scroll-wheel zoom (with focus on cursor position).
  - Ensure that object coordinate system remains stable and rendering accounts for viewport transform.

**Acceptance criteria:**

- User can undo and redo a series of operations (create, move, resize, delete, text changes).
- Undo/redo works consistently after multiple operations and persists correctly across reload (using stored events and/or reconstructed state).
- User can pan around and zoom in/out while drawing and editing.
- Tests validate undo/redo behavior on event sequences and basic viewport transformations in the rendering logic.

---

## Step 8 – Export/Import & Image Export

**Goal:** Implement export/import of board data and basic image export for sharing.

**Scope:**

- Structured export/import:
  - Define a serializable format for board export:
    - Board metadata
    - Current objects
    - Optional: full event list (if already captured)
  - Export:
    - Provide a button “Export board” that triggers download of a `.json` (or similar) file.
  - Import:
    - From the board list page, add “Import board” action:
      - User selects an export file.
      - The app validates and creates a new board with imported content.
- Image export:
  - Implement image export from the current canvas view:
    - Render the board content at a suitable resolution to an off-screen canvas.
    - Use browser APIs to create and trigger download of an image file (e.g., PNG).
  - Optionally provide basic controls:
    - Export full board vs. visible viewport.
- Error handling:
  - Show clear messages if import fails (invalid format, missing fields, etc.).

**Acceptance criteria:**

- User can export a board as a structured data file and re-import it into the app.
- Imported boards appear in the board list and behave like normal boards.
- User can export current board view as an image file and download it.
- Tests cover serialization/deserialization of board data and guard against invalid import data.

---

## Step 9 – UI Polish, Responsiveness & Basic Theming

**Goal:** Refine the UI so that it is pleasant to use, responsive, and consistent across devices.

**Scope:**

- Layout refinements:
  - Ensure sidebar, top bar, and canvas adjust gracefully across desktop, tablet, and mobile.
  - Use a flexible layout system so the canvas gets as much space as possible.
- Responsive behavior:
  - On smaller screens, consider collapsing toolbars into icons or menus.
  - Verify that touch interactions (drawing, panning, selecting) are usable on tablets and phones.
- Theming:
  - Introduce a simple theming concept (e.g., light/dark modes).
  - Ensure sufficient contrast for shapes, sticky notes, and text.
- UX details:
  - Show tooltips or labels for tools and buttons.
  - Add visual feedback for active tools and pressed buttons.
  - Handle “unsaved changes” message only if necessary (local auto-save may be sufficient).

**Acceptance criteria:**

- Application is usable and visually coherent on common desktop and mobile/tablet resolutions.
- No critical layout issues when switching between portrait and landscape modes on mobile/tablet.
- Tool selection and states are obvious to the user.
- Manual exploratory tests confirm basic usability for the main flows on at least desktop + one mobile simulator/emulator.

---

## Step 10 – Testing, Documentation & Final GitHub Pages Setup

**Goal:** Add a reasonable set of automated tests, basic developer documentation, and finalize GitHub Pages deployment and CI.

**Scope:**

- Testing:
  - Unit tests for:
    - Domain logic (`applyEvent`, undo/redo, serialization).
    - Repository logic (with storage mocked).
  - Component tests with React Testing Library for:
    - Board list page (create, rename, delete interactions).
    - Basic board editor interactions (creating and rendering objects, selection).
- CI setup (optional but recommended):
  - Configure a simple GitHub Actions workflow to:
    - Run tests on pushes and pull requests.
    - Build the app.
    - Optionally, deploy to GitHub Pages on successful builds from `main`.
- Documentation:
  - Update README with:
    - Overview of the application and its purpose.
    - Setup instructions (install dependencies, run, test, build).
    - Deployment instructions (how GitHub Pages deployment works).
    - Short architecture overview (domain model, event flow, storage).
- Final deployment check:
  - Verify that the deployed PWA on GitHub Pages:
    - Loads correctly on desktop and mobile.
    - Is installable.
    - Works offline for previously visited boards.

**Acceptance criteria:**

- A set of Jest tests runs successfully and covers core logic and critical UI behavior.
- GitHub Actions (if configured) runs tests and build without errors.
- GitHub Pages deployment is stable; the app is reachable via repository URL.
- README provides enough information for another developer (or future you) to understand and extend the project.
