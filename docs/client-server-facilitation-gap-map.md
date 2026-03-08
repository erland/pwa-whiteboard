# Client/server facilitation + sharing gap map

Last updated: 2026-03-08

This document baselines the **currently implemented `pwa-whiteboard` client surface** against the **already available `java-whiteboard-server` feature surface** so later client work can reuse verified seams instead of rediscovering them.

It is intentionally practical:
- what the client already consumes
- what the server already exposes but the client does not yet use
- where each upcoming feature should attach in the current client codebase
- which existing tests/build commands were used to re-establish a safe baseline

---

## 1. Baseline verification

Verified from the current repository state using the existing package scripts:

```bash
npm test -- --runInBand
npm run build
```

### Result

- `npm test -- --runInBand` ✅ passed
- `npm run build` ✅ passed

This establishes that the repo is stable before adding Review & Facilitation Pack / Sharing & Access Pack work.

---

## 2. Current client/server surface that is already in use

## 2.1 REST APIs currently consumed by the client

### Board management
Client files:
- `src/api/boardsApi.ts`
- `src/pages/boardList/useBoardListPageModel.ts`
- `src/pages/BoardEditorPage.tsx`

Current usage:
- list boards
- create board
- rename board
- delete/archive board
- set remote board type
- fetch board metadata where needed

### Snapshots
Client files:
- `src/api/snapshotsApi.ts`
- `src/pages/hooks/collab/useSnapshotOrchestration.ts`
- `src/pages/hooks/collab/useSnapshotSync.ts`

Current usage:
- list snapshot versions
- fetch latest snapshot
- create snapshot
- bootstrap board state after collaborative join

### Invites (partial)
Client files:
- `src/api/invitesApi.ts`
- `src/pages/BoardEditorPage.tsx`
- `src/pages/boardEditor/SharePanel.tsx`
- `src/pages/boardEditor/ShareDialog.tsx`
- `src/infrastructure/localStorageInvitedBoardsRepository.ts`

Current usage:
- create invite link
- validate invite token
- accept invite into persisted membership
- open board via invite query/hash token
- persist invited-board re-entry metadata locally

### Identity / auth
Client files:
- `src/auth/*`
- `src/config/server.ts`
- `src/pages/boardList/useBoardListPageModel.ts`
- `src/pages/BoardEditorPage.tsx`

Current usage:
- OIDC sign-in
- access token retrieval for REST
- guest-vs-authenticated join choice in invite flow
- server configured / OIDC configured gating

---

## 2.2 WebSocket protocol currently consumed by the client

Client files:
- `src/collab/CollabClient.ts`
- `src/pages/hooks/useBoardCollaboration.ts`
- `src/pages/hooks/collab/useCollabConnectionLifecycle.ts`
- `src/pages/hooks/collab/collabPresence.ts`
- `src/pages/boardEditor/RemoteCursorsOverlay.tsx`
- `shared/protocol/*`

Current inbound message usage:
- `joined`
- `op`
- `presence`
- `error`
- `pong`

Current outbound message usage:
- `op`
- `ping`

Important current constraint:
- `CollabClient.sendPresence()` is intentionally a no-op right now, so richer live presence/facilitation features are **not yet wired**, even though the client already has `PresencePayload` types and a `RemoteCursorsOverlay` rendering seam.

---

## 3. Server feature surface that appears to exist but is not yet used in the client

This section is the actual implementation target inventory for the upcoming packs.

## 3.1 Comments

Server support already available:
- board comment listing
- comment creation
- comment update
- resolve / reopen
- delete
- targets for board/object/region/reply workflows

Current client status:
- no dedicated API wrapper under `src/api`
- no comments hook
- no comments panel / overlay / marker UI
- no editor shell integration

Implementation seam candidates:
- `src/api/commentsApi.ts`
- `src/pages/hooks/useBoardComments.ts`
- `src/pages/boardEditor/comments/*`
- `src/pages/boardEditor/BoardEditorShell.tsx`

## 3.2 Voting

Server support already available:
- create voting session
- list sessions
- get session
- open / close / reveal / cancel session
- cast vote / remove vote
- fetch results

Current client status:
- no voting API wrapper
- no facilitator controls
- no participant voting UI
- no board-level result overlay or side panel

Implementation seam candidates:
- `src/api/votingApi.ts`
- `src/pages/hooks/useBoardVoting.ts`
- `src/pages/boardEditor/voting/*`
- `src/pages/boardEditor/BoardEditorHeader.tsx`
- `src/pages/boardEditor/BoardEditorShell.tsx`

## 3.3 Shared timer

Server support already available:
- shared timer REST/state endpoints
- timer-related ephemeral WebSocket events

Current client status:
- no timer API wrapper
- no timer hook
- no timer display or facilitator control UI

Implementation seam candidates:
- `src/api/timerApi.ts`
- `src/pages/hooks/useSharedTimer.ts`
- `src/pages/boardEditor/facilitation/*`
- `src/pages/boardEditor/BoardEditorHeader.tsx`
- `src/pages/boardEditor/BoardEditorShell.tsx`

## 3.4 Reactions and richer ephemeral collaboration

Server support already available:
- ephemeral reactions
- timer-control / timer-state events
- cursor / viewport / follow style ephemeral collaboration support (per server-side analysis and contract notes)

Current client status:
- `PresencePayload` already models cursor / selection / viewport / typing
- `RemoteCursorsOverlay.tsx` already exists
- connection/presence state already flows through `useBoardCollaboration`
- outbound presence is not sent
- richer inbound ephemeral handling is not surfaced in the editor UI

Implementation seam candidates:
- `src/collab/CollabClient.ts`
- `src/pages/hooks/collab/usePresenceSender.ts`
- `src/pages/hooks/collab/collabPresence.ts`
- `src/pages/hooks/useBoardCollaboration.ts`
- `src/pages/boardEditor/RemoteCursorsOverlay.tsx`
- `src/pages/boardEditor/facilitation/*`

## 3.5 Publications / public review links

Server support already available:
- create publication
- list publications
- revoke publication
- rotate publication token
- resolve publication anonymously
- live-board vs snapshot publication target
- optional publication comment policy

Current client status:
- no publication API wrapper
- no publication management UI
- no share dialog support for read-only/public links
- no publication-aware review flow in editor shell

Implementation seam candidates:
- `src/api/publicationsApi.ts`
- `src/pages/hooks/useBoardPublicationManager.ts`
- `src/pages/boardEditor/sharing/*`
- `src/pages/boardEditor/SharePanel.tsx`
- `src/pages/boardEditor/ShareDialog.tsx`

## 3.6 Invite administration beyond link creation

Server support already available:
- list invites
- revoke invite
- richer invite metadata management

Current client status:
- `src/api/invitesApi.ts` only covers create/validate/accept
- `SharePanel.tsx` only handles create + validate + accept
- no invite list
- no revoke flow
- no active/expired/revoked management UI

Implementation seam candidates:
- extend `src/api/invitesApi.ts` or add `src/api/invitesAdminApi.ts`
- `src/pages/hooks/useBoardInviteManager.ts`
- `src/pages/boardEditor/SharePanel.tsx`
- `src/pages/boardEditor/sharing/*`

## 3.7 Capabilities

Server support already available:
- capability discovery endpoint / capability model for server-supported and board-allowed features

Current client status:
- no capability wrapper
- no centralized capability hook
- most gating today is derived from:
  - auth state
  - invite flow state
  - read-only/collab role state
  - server configured / OIDC configured flags

Implementation seam candidates:
- `src/api/capabilitiesApi.ts`
- `src/pages/hooks/useBoardCapabilities.ts`
- `src/pages/hooks/useBoardPolicy.ts`
- `src/pages/BoardEditorPage.tsx`
- `src/pages/boardEditor/BoardEditorShell.tsx`
- `src/pages/boardEditor/SharePanel.tsx`

---

## 4. Exact client integration seams to reuse

These are the existing files that already represent the safest attachment points for the new work.

## 4.1 Page-level orchestration

### `src/pages/BoardEditorPage.tsx`
Use for:
- route-level feature bootstrap
- invite/publication/capability-aware flow decisions
- wiring new hooks into the editor shell

Avoid growing it with feature-specific data logic if a hook can own that logic instead.

### `src/pages/boardEditor/BoardEditorShell.tsx`
Use for:
- adding new side panels, overlays, status bars, and toolbar affordances
- integrating review/facilitation widgets into the editor layout
- rendering comments, timer, voting, presence, and sharing UI once data already exists

### `src/pages/boardEditor/BoardEditorHeader.tsx`
Use for:
- header actions such as share, comments, voting, timer, publish, facilitator controls

---

## 4.2 Existing sharing/access seams

### `src/pages/boardEditor/ShareDialog.tsx`
Current role:
- modal container for sharing-related content

Best next use:
- keep as the main host for invite management + publication management

### `src/pages/boardEditor/SharePanel.tsx`
Current role:
- create invite link
- validate current invite
- accept current invite when authenticated

Best next use:
- extend into a combined **Invite Management + Publication Management** panel
- keep current create/accept behavior as one subsection rather than replacing it

### `src/pages/boardEditor/gates/InviteChoiceGate.tsx`
### `src/pages/boardEditor/gates/InviteAcceptanceGate.tsx`
Current role:
- route-level invite flow gating

Best next use:
- stay focused on invite acceptance; do not overload with publication logic except where anonymous published access needs a similar gate

---

## 4.3 Collaboration seams

### `src/pages/hooks/useBoardCollaboration.ts`
Current role:
- owns high-level collaboration state returned to the editor

Best next use:
- remain the aggregator for collaboration state
- delegate richer presence / reactions / timer event handling to narrower hooks instead of inflating this file

### `src/pages/hooks/collab/useCollabConnectionLifecycle.ts`
Current role:
- socket creation and inbound event dispatch

Best next use:
- extend carefully for new inbound server message handling
- keep transport/lifecycle concerns here, not UI reactions

### `src/pages/hooks/collab/collabPresence.ts`
Current role:
- normalizes joined/presence user lists

Best next use:
- central place to evolve presence normalization when richer presence payloads start flowing

### `src/pages/hooks/collab/usePresenceSender.ts`
Current role:
- wraps outbound op/presence sending

Best next use:
- first place to enable real outbound cursor/viewport/typing/selection updates once server/client contract is confirmed feature-by-feature

### `src/pages/boardEditor/RemoteCursorsOverlay.tsx`
Current role:
- renders remote cursor indicators when `presenceByUserId` contains cursor payloads

Best next use:
- extend for richer collaborator indicators once live cursor/viewport data is actually being populated

---

## 4.4 Board access / permissions seams

### `src/pages/hooks/useBoardPolicy.ts`
Current role:
- board-type/toolbox policy

Best next use:
- continue owning board-type editing policy only
- do **not** overload with server capability discovery; create a separate capability hook instead

### `src/pages/hooks/useBoardEditor.ts`
### `src/pages/hooks/useBoardPersistence.ts`
### `src/pages/hooks/useBoardMutations.ts`
Current role:
- editor state, persistence, local mutation orchestration

Best next use:
- keep review/facilitation state separate from drawing engine state unless a feature truly affects persisted board content

### `src/pages/boardList/useBoardListPageModel.ts`
Current role:
- board source aggregation and server/local/invite list workflows

Best next use:
- likely future entry point for showing publication-managed or review-related entry affordances on the board list
- not the first seam for comments/voting/timer work

---

## 5. Feature-by-feature recommended attachment map

| Feature | First API seam | First hook seam | First UI seam |
|---|---|---|---|
| Comments | `src/api/commentsApi.ts` | `src/pages/hooks/useBoardComments.ts` | `src/pages/boardEditor/comments/*` + `BoardEditorShell.tsx` |
| Voting | `src/api/votingApi.ts` | `src/pages/hooks/useBoardVoting.ts` | `BoardEditorHeader.tsx` + `boardEditor/voting/*` |
| Shared timer | `src/api/timerApi.ts` | `src/pages/hooks/useSharedTimer.ts` | `BoardEditorHeader.tsx` / facilitation bar |
| Reactions | `src/collab/CollabClient.ts` | `src/pages/hooks/useBoardReactions.ts` or collab sub-hook | `boardEditor/facilitation/*` |
| Rich presence | collab transport + protocol normalization | `usePresenceSender.ts` / collab presence hook | `RemoteCursorsOverlay.tsx` |
| Publications | `src/api/publicationsApi.ts` | `src/pages/hooks/useBoardPublicationManager.ts` | `SharePanel.tsx` / `ShareDialog.tsx` |
| Invite administration | extend `src/api/invitesApi.ts` or add admin wrapper | `src/pages/hooks/useBoardInviteManager.ts` | `SharePanel.tsx` |
| Capabilities | `src/api/capabilitiesApi.ts` | `src/pages/hooks/useBoardCapabilities.ts` | `BoardEditorPage.tsx` + `BoardEditorShell.tsx` |

---

## 6. Current gaps that should stay explicit during implementation

## 6.1 Presence sending is not active yet

Even though the shared protocol types allow cursor/selection/viewport/typing payloads and the UI has a remote cursor overlay, the current client deliberately does not send presence updates.

Implication:
- do not assume live cursors/follow/reaction support is already “almost done”
- the transport and state seams exist, but the feature still needs a deliberate activation step

## 6.2 Capability-aware UI does not exist yet

Current client gating is mostly a combination of:
- auth state
- invite token flow
- collab role / read-only behavior
- static server-configured checks

Implication:
- capability-aware UI should be implemented as a new cross-cutting layer, not scattered as one-off boolean checks

## 6.3 Share UI is invite-centric today

The current share flow is built around invite creation and acceptance, not around a broader “sharing administration” model.

Implication:
- publication management and invite management should be added by expanding this existing seam, not by creating a separate unrelated sharing surface first

---

## 7. Recommended immediate next implementation order

1. Add typed wrappers for **capabilities**, **comments**, **publications**, and **invite administration**.
2. Add a dedicated `useBoardCapabilities` hook so later UI work can gate features consistently.
3. Extend `SharePanel.tsx` / `ShareDialog.tsx` with:
   - invite list + revoke
   - publication list + create/revoke/rotate
4. Add comments as the first review feature in the editor shell.
5. Add voting + shared timer + reactions after the capability-aware UI layer exists.

This order reuses the seams above while avoiding early UI churn inside `BoardEditorPage.tsx` and `useBoardCollaboration.ts`.

---

## 8. Files touched in this baseline step

- added `docs/client-server-facilitation-gap-map.md`

No runtime behavior changes were made in this baseline step. The goal of this step is to make the current integration surface explicit and verified before feature implementation begins.
