# Whiteboard PWA – Functional Specification (v2: Multi‑user)

> This document describes *what* the application must do (user-facing behavior and functional requirements). It intentionally avoids committing to specific hosting providers or implementation libraries.

## 1. Purpose

The Whiteboard app is a browser-based whiteboard for creating and editing visual boards containing shapes, text, sticky notes, freehand strokes, and connectors. Boards can be used locally by a single user and can also be shared for real-time collaboration with multiple users.

## 2. Scope

### 2.1 In scope
- Board creation and management (create, rename, duplicate, delete, import/export).
- Editing tools (select, shapes, text, sticky note, freehand, connectors).
- Multi-user collaboration on the same board in real time:
  - Live updates (authoritative ordered operation log).
  - Presence (who is in the room, cursors, optional selection indicators).
  - Sharing via invite URLs (with role-based access).
- Basic security controls appropriate for link sharing and collaborative editing.

### 2.2 Out of scope (v2)
- Real-time voice/video chat.
- Granular per-object permissions beyond the board-level roles described below.
- Full audit/compliance-grade immutable history (can be added later).
- Complex conflict-free data types (CRDT). This version uses ordered operations with deterministic application.

## 3. Terminology

- **Board**: A named workspace containing drawable objects and metadata.
- **Object**: An item on a board, e.g., rectangle, ellipse, text, sticky note, freehand stroke, connector.
- **Operation (Op)**: A change to the shared board state (create/update/delete/reorder, etc.).
- **Room**: A collaboration session for a specific board.
- **Presence**: Ephemeral data about connected users (cursor, selection, name/color), not part of the board’s persisted content.
- **Owner**: The user who created the board and controls sharing links.
- **Editor**: A user invited with write access.
- **Viewer**: A user invited with read-only access.

## 4. Users, Roles, and Access Model

### 4.1 Roles
- **Owner**
  - Full read/write on the board.
  - Can generate, revoke, and rotate invite links (viewer and editor links).
- **Editor**
  - Read/write access on the board while connected.
  - Cannot manage invite links (unless explicitly granted in future versions).
- **Viewer**
  - Read-only access.
  - May see live updates and presence but cannot modify board content.

### 4.2 Authentication and invite links
- The **Owner must authenticate** to create and manage boards and sharing settings.
- Editors and viewers **may access a board without authentication** by using an invite URL that grants access to a specific board and role.
- Invite URLs must be:
  - **Unguessable** (strong random capability token).
  - **Scoped** (bound to a single board and role).
  - **Time-limited** (configurable expiration).
  - **Revocable** (owner can disable a link).
  - **Rotatable** (owner can regenerate links to invalidate old ones).

### 4.3 Guest identity (non-authenticated participants)
When joining via invite URL without authentication:
- The system assigns the participant a **guest identity** (display name + color).
- The participant may optionally set a display name.
- The system should remember the guest’s chosen name/color on that device for convenience (local preference), while acknowledging it is not a strong identity.

## 5. Board Management

### 5.1 Board list
Users can:
- Create a new board.
- Open an existing board.
- Rename a board.
- Duplicate a board.
- Delete a board.
- Import a board from an exported file.
- Export a board to a portable file format.

### 5.2 Board metadata
Boards include:
- Title/name.
- Creation timestamp and last modified timestamp.
- Optional board type/preset (toolbox configuration and policies).
- Sharing state (viewer link, editor link, enabled/disabled, expiration).

## 6. Editing Features

### 6.1 Canvas & navigation
- Pan and zoom the canvas.
- Grid and outlines (if supported by the application UI).
- Responsive layout for desktop and mobile devices.

### 6.2 Tools and objects
The app supports (at minimum):
- **Select** tool: select one or multiple objects.
- **Shapes**: rectangle, ellipse.
- **Text** object.
- **Sticky note** object.
- **Freehand** drawing.
- **Connector** (line connecting objects/points).

### 6.3 Object manipulation
- Create objects by clicking/dragging.
- Move objects by dragging.
- Resize objects via handles.
- Edit text/sticky-note content.
- Change styling properties (e.g., stroke width, colors, font size as applicable).
- Multi-select and apply shared properties where applicable.

### 6.4 Clipboard and duplication
- Copy and paste selected objects (within a board).
- Duplicate selection.

### 6.5 Undo/redo behavior (single-user vs multi-user)
- **Single-user mode**: undo/redo works as expected for local history.
- **Multi-user mode (v2)**: undo/redo behavior is intentionally conservative:
  - Minimum requirement: undo/redo may be disabled while connected to a multi-user session, or limited to local, non-shared UI actions.
  - If enabled, “undo my last action” must not remove or reorder other users’ actions unexpectedly.
  - A future version may introduce robust multi-user undo with inverse operations and author tracking.

## 7. Multi-user Collaboration

### 7.1 Collaboration goals
When multiple people edit the same board:
- Everyone sees updates in near real time.
- The board converges to the same final state for all participants.
- Conflicts are resolved deterministically.

### 7.2 Room join and state sync
When a participant opens a shared board:
1. The client connects to the collaboration service and joins the board’s room.
2. The participant receives the **current board snapshot** and the latest **sequence number (seq)**.
3. The participant receives subsequent ordered operations and applies them in sequence.

### 7.3 Authoritative ordered op log
- All shared edits are transmitted as **operations**.
- The collaboration service assigns a **monotonic sequence number** to each accepted operation.
- All clients apply operations in that server-defined order.
- Clients must ignore duplicate operations (idempotency) and already-applied sequence numbers.

### 7.4 Conflict handling
Because multiple edits can happen concurrently:
- The system resolves conflicts by the authoritative order:
  - Later operations override earlier operations when they target the same properties (“last write wins” in the ordered stream).
- Operations should be granular (property-level updates) to reduce unintended overwrites.

### 7.5 Presence (ephemeral)
Presence information is not persisted as board content. It includes:
- User list (name, color, role).
- Cursor position (optional but recommended).
- Optional: current selection outline(s) or “user is editing text” indicators.

Presence should be rate-limited/throttled to avoid excessive network traffic.

### 7.6 Live editing behaviors and bandwidth considerations
To keep collaboration responsive:
- **Dragging/moving/resizing**: updates may be coalesced (e.g., periodic updates plus a final commit on release).
- **Freehand**:
  - Users should see a smooth local preview while drawing.
  - The shared model should prefer **batched** updates or a final stroke commit to reduce message volume.
- The system must define maximum sizes for:
  - operation payloads,
  - text length,
  - freehand point counts / stroke size,
  - number of objects per board (soft limits).

### 7.7 Connection handling
- If the network disconnects:
  - The UI must indicate “Disconnected / Reconnecting”.
  - The board remains viewable.
  - Editing may be disabled until reconnected (v2), or queued optimistically with clear user feedback (future enhancement).
- On reconnect:
  - The client re-joins and re-syncs from snapshot + operations.

## 8. Persistence and Data Handling

### 8.1 Persistence responsibilities
This version distinguishes between:
- **Durable board content** (persisted):
  - objects, properties, ordering, board type, metadata.
- **Ephemeral presence** (not persisted):
  - cursors, live selections, “is typing” indicators.

### 8.2 Snapshotting and replay
- The system must persist the board as:
  - periodic **snapshots**, and optionally
  - an **operation log** since the last snapshot.
- The system must be able to reconstruct current state by applying operations after the snapshot.

### 8.3 Export/import
- Export includes board content and metadata required to restore the board locally or on another system.
- Export must not embed sensitive invite tokens by default.
- Import restores board content; sharing settings are reset/disabled by default unless explicitly included and the user has permission.

## 9. Security and Privacy Requirements

### 9.1 Trust boundaries
- Clients are untrusted. The server/collaboration service must validate:
  - access rights (viewer/editor),
  - operation structure and allowed fields,
  - rate limits and message sizes.

### 9.2 Invite token security
- Invite tokens must be treated as secrets.
- The application must provide controls to:
  - disable a link immediately,
  - regenerate new links (rotate),
  - set expirations.
- The system should minimize accidental leakage (e.g., avoid logging full URLs with tokens).

### 9.3 Transport security
- Communication must use encrypted transport in production environments.
- The collaboration service must restrict cross-site usage appropriately (e.g., origin checks).

### 9.4 Content safety
- Text objects must be treated as plain text (no unsafe HTML execution).
- Imported files must be validated before applying to the shared state.

### 9.5 Logging and observability (privacy-aware)
- The system should log key events (join/leave, accepted/rejected ops) with minimal personal data.
- If guests are allowed, logs may include a guest identifier but should avoid storing unnecessary personal information.

## 10. Performance and Quality Requirements

- Target “feels real-time” collaboration for typical interactions.
- Canvas rendering should remain smooth during editing (local preview preferred).
- The system should degrade gracefully under load (coalescing updates, throttling presence).
- The application must remain usable on modern desktop and mobile browsers.

## 11. Accessibility and Usability

- Keyboard shortcuts for common actions (select, delete, copy/paste) where appropriate.
- Clear UI states for:
  - role (viewer vs editor),
  - connection status,
  - “read-only” mode for viewers,
  - sharing status (link enabled/disabled, expiration).

## 12. Future Enhancements (not required for v2)
- Multi-user undo/redo (“undo my last op”) with inverse operations and author tracking.
- Offline-first collaboration (queue ops while offline, reconcile on reconnect).
- Commenting, version history UI, and audit trail.
- Templates and board organization (folders, tags).
- Advanced permissions (per-object locks, admin roles, organization ownership).
