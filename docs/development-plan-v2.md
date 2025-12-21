# Whiteboard PWA – Development Plan (v2: Multi-user, Cloudflare + Supabase)

This plan describes how I would implement the multi-user functionality from `docs/specification.md (v2)` using:
- **Cloudflare Pages** for the web app hosting,
- **Cloudflare Workers + Durable Objects** for authoritative real-time collaboration rooms,
- **Supabase Auth + Postgres** for users, boards metadata/ACL, invite links, and snapshots (durable persistence).

It is structured as “steps” that are each testable end-to-end.

---

## Step 0 — Baseline & scaffolding

**Goal:** Prep the repo for shared code and a worker package.

Deliverables:
- Add folders:
  - `shared/`
  - `workers/collab/`
- Add TypeScript configs so both can build (two `tsconfig.json` or one with project references).
- Add a small “shared” barrel export strategy.

Tests / checks:
- `npm test` and `npm run build` still pass for the existing frontend.

---

## Step 1 — Define the collaboration protocol + shared schemas

**Goal:** Create a stable wire protocol for ops/presence/sync.

In `shared/protocol/` define:
- Message types:
  - `join` / `joined`
  - `op` (server-ordered)
  - `presence`
  - `error`
  - `ping/pong` (optional)
- Fields:
  - `boardId`
  - `seq` (server sequence number)
  - `clientOpId` (idempotency UUID)
  - `baseSeq` (last seq client believes it has applied)
  - `role` (viewer/editor/owner)
  - `authorId` (server-derived)
- Payload limits (constants):
  - max message size
  - max text length
  - max stroke payload size / points
- **Runtime validation schemas** (recommended):
  - Zod schemas for each message (client & server use same schemas)

Tests:
- Unit tests for schema validation (valid/invalid messages).
- Snapshot tests for protocol JSON examples (optional).

---

## Step 2 — Refactor domain state so it can run in the Worker

**Goal:** Reuse your existing “apply event” logic on the server.

Actions:
- Move/duplicate purely functional parts of the state reducer into `shared/domain/`:
  - types (`WhiteboardState`, object types, events/ops)
  - `applyEvent(state, event)` (or `applyOp`)
- Ensure it has **no DOM dependencies** (Workers don’t have browser DOM APIs).

Tests:
- Existing domain tests continue passing.
- Add a small test that applies a sequence of ops and verifies deterministic state.

---

## Step 3 — Supabase setup: Auth + database schema + RLS

**Goal:** Establish durable identity for owners + durable board metadata.

In Supabase:
- Enable an auth provider (email magic link, GitHub, etc.).
- Create tables (suggested minimal set):
  - `boards`:
    - `id` (uuid)
    - `owner_user_id` (uuid)
    - `title`
    - `created_at`, `updated_at`
    - `snapshot_seq` (bigint)  — last persisted seq
  - `board_invites`:
    - `id` (uuid)
    - `board_id`
    - `role` (viewer/editor)
    - `token_hash` (text) or store `token` only if you accept that risk
    - `expires_at`
    - `revoked_at`
    - `created_by_user_id`
  - `board_snapshots` (or store snapshot on `boards`):
    - `board_id`
    - `seq`
    - `snapshot_json`
    - `created_at`
- RLS policies:
  - Owners can CRUD their boards.
  - Owners can create/revoke invites for their boards.
  - (Optional) store explicit board members later; for now link-based access can bypass per-user ACL.

Notes:
- Keep invite tokens as **capabilities**; hash them in DB if possible.
- Avoid storing invite tokens in exports by default (spec requirement).

Tests / checks:
- SQL migration scripts checked into repo under `workers/collab/migrations/` or `supabase/`.
- Manual verification in Supabase UI:
  - owner can list boards,
  - invites can be created/revoked,
  - RLS blocks non-owners from reading other boards directly.

---

## Step 4 — Cloudflare Worker + Durable Object skeleton

**Goal:** Create a collaboration service that can accept WebSocket connections per board.

In `workers/collab/`:
- `wrangler.toml` with:
  - Durable Object binding (e.g., `BOARD_ROOM_DO`)
  - env vars:
    - Supabase URL
    - Supabase service role key (server-only)
    - Invite signing secret (optional, if using signed tokens)
- Worker routes:
  - `GET /collab/:boardId` upgrades to WebSocket and forwards to the DO instance for that board.

Tests / checks:
- Local dev using Wrangler (connect with a small Node WS client).
- Basic “echo” WebSocket works end-to-end.

---

## Step 5 — Implement join/auth/invite validation on the server

**Goal:** Enforce viewer/editor access at join time.

Server behavior (in DO):
- Client sends `join` with either:
  - `ownerAuthToken` (Supabase JWT) **or**
  - `inviteToken`
- DO validates:
  - Supabase JWT signature and user id (owner flows)
  - Invite token by looking up `board_invites` (and checking `revoked_at` and `expires_at`)

Role assignment:
- Owner JWT → role = `owner`
- Valid invite → role = invite.role
- Otherwise reject with `error` and close WS.

Security controls (MVP):
- Enforce max message size.
- Validate `Origin` header allowlist (during Worker fetch).
- Rate-limit join attempts per IP/board (coarse).

Tests:
- Unit test token validation logic (signed/expired/revoked).
- Integration test:
  - connect with valid viewer token → can join but cannot send ops,
  - connect with editor token → can send ops,
  - connect with invalid token → rejected.

---

## Step 6 — Implement authoritative ordered op log (real-time convergence)

**Goal:** Make server order operations and broadcast to all clients.

In the DO:
- Maintain:
  - `seq` (bigint)
  - `state` (current whiteboard state in memory)
  - `clients` set
  - `processedClientOpIds` with TTL (idempotency)
- On `op` from an editor/owner:
  - validate op schema
  - validate role (viewer cannot op)
  - apply rate limits (ops/sec)
  - `seq += 1`
  - apply op to `state` using `shared/domain/applyEvent`
  - broadcast `{type:"op", seq, op, authorId}` to all clients

Client behavior:
- Apply only server-sent ops in order (ignore duplicates / old `seq`).

Tests:
- Determinism test: two clients receive the same ordered stream → identical state.
- Permission test: viewer op rejected.

---

## Step 7 — Snapshots to Supabase (durability)

**Goal:** Ensure boards persist beyond server restarts and new joiners can sync quickly.

Approach (recommended MVP):
- Persist a snapshot periodically:
  - every N accepted ops (e.g., 25–100) OR every T seconds (e.g., 5–15s), whichever first.
- Persist:
  - `snapshot_json` (full board state)
  - `snapshot_seq`
- On cold start / first join:
  - load latest snapshot from Supabase
  - initialize `seq = snapshot_seq`
  - start accepting ops

Optional enhancement (later):
- Also store an op log since last snapshot for better durability if a crash happens between snapshots.

Tests:
- Start DO, draw, force restart (simulate), rejoin → snapshot restores most recent persisted state.
- Schema/version test: snapshots include a `schemaVersion` field and can be migrated later.

---

## Step 8 — Frontend: collaboration mode integration

**Goal:** Add real-time collaboration to the existing editor UI.

Frontend deliverables:
- `CollabClient` abstraction:
  - connect/join
  - send ops
  - send presence
  - receive ops/snapshots
- Integrate into existing store:
  - local mode (today)
  - collab mode (apply server ops)
- UI indicators:
  - connection status (connected/reconnecting/read-only)
  - role badge (viewer/editor/owner)
- Presence rendering:
  - remote cursors + names (non-persistent overlay)

Behavior rules (per spec):
- Throttle presence (e.g., 100–200ms).
- Coalesce drag ops:
  - periodic updates while dragging
  - final commit on release
- Freehand:
  - local preview while drawing
  - commit stroke as one op on pointer-up (or a few chunks)

Undo/redo:
- In collab mode, disable undo/redo (MVP) or limit to local-only UI operations.

Tests:
- E2E smoke test (manual is fine initially):
  - open same board in two browsers, see edits live.
- Unit tests for CollabClient message parsing and sequencing.

---

## Step 9 — Sharing UI: create/revoke/rotate invite links

**Goal:** Make it usable to share a board without requiring others to authenticate.

Frontend additions:
- “Share” panel on board page:
  - Viewer link (toggle enable/disable, expiration)
  - Editor link (toggle enable/disable, expiration)
  - “Regenerate link” (rotate)
- “Join as guest” flow:
  - prompt for display name on first join (optional)
  - store guest preferences locally

Backend:
- Supabase functions/queries to create/revoke/rotate invites (owner-authenticated).
- DO join validates invite tokens.

Tests:
- Revoke link → existing connections keep working (optional) but new joins fail.
- Rotate link → old link fails, new link works.

---

## Step 10 — Security hardening pass

**Goal:** Prevent common abuse modes and reduce risk of token leakage.

Server-side:
- Strict message size caps.
- Op validation with safe bounds (text length, points, number of objects).
- Rate limits:
  - ops/sec per connection
  - presence updates/sec per connection
- Origin allowlist for WS upgrade.
- Never log invite tokens.

Frontend:
- Avoid embedding invite tokens in exports.
- Prefer URL fragment for invite token (optional improvement) or set strict referrer policy.

Tests:
- Fuzz a few malformed messages to ensure server rejects cleanly without crashing.

---

## Step 11 — Deployment (GitHub Pages frontend + Cloudflare Worker) + CI

**Goal:** Keep the frontend on GitHub Pages (already in place) and deploy only the collaboration backend to Cloudflare, with repeatable CI.

### Frontend: GitHub Pages (existing)
- Build the web app with Vite and deploy to GitHub Pages using your existing workflow.
- Ensure the app is configured for GitHub Pages hosting:
  - Vite `base` is set correctly (e.g. `"/<repo>/"` when not using a custom domain).
  - SPA routing fallback is handled (if you add routes beyond the root).
- Configure **client-side** environment values at build time:
  - Collaboration Worker base URL (public): e.g. `VITE_COLLAB_BASE_URL`
  - Supabase URL + public anon key (public): e.g. `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### Backend: Cloudflare Worker (collab)
- Deploy the Worker (and Durable Object) via Wrangler.
- Configure **server-only** secrets in Cloudflare:
  - Supabase service role key (server-only)
  - Invite signing secret (if you use invite tokens)
- Configure allowed origins / CORS rules to include your GitHub Pages origin (and any custom domain if applicable).

### CI: GitHub Actions
- Keep the current GitHub Pages workflow for the frontend (build + deploy).
- Add a separate Worker deployment job/workflow:
  - Run tests (shared + worker, as applicable)
  - `wrangler deploy` on `main` (or on tags/releases)
  - Use GitHub Secrets for Cloudflare credentials (API token, account id, etc.)

Tests:
- Smoke test in a staging Worker environment (optional but recommended) before promoting to production.

---
## Step 12 — Polish & operational readiness

**Goal:** Make it stable and pleasant to use.

- Better reconnect UX:
  - “Reconnecting…” overlay
  - auto-rejoin + resync
- Metrics/logging (privacy-aware):
  - join/leave counts
  - rejected ops counts
  - snapshot timings
- Soft limits and helpful error messages (e.g., “Board too large” / “Stroke too long”).

---

## MVP acceptance criteria

The MVP is “done” when:
- Owner can authenticate and create boards.
- Owner can generate viewer and editor invite links.
- Guest viewer can open the board and see updates live.
- Guest editor can draw/move/edit and all participants see changes live.
- Server orders ops with increasing `seq` and all clients converge.
- Presence shows at least user list and cursors.
- Board state persists via snapshots and survives reconnect/reload.

