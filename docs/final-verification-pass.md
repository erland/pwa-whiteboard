# Final verification pass: pwa-whiteboard against java-whiteboard-server

Last updated: 2026-03-08

This verification pass is the final stabilization step after the Review & Facilitation Pack and Sharing & Access Pack client integration.

## Verified commands

Run these from the project root:

```bash
npm test -- --runInBand
npm run typecheck
npm run build
```

For this final client pack integration, both the Jest suite and the production build completed successfully.

## What the final verification now covers

### 1. Server REST contract

Covered by:
- `src/api/__tests__/javaWhiteboardServerIntegration.test.ts`
- `src/api/__tests__/facilitationApis.test.ts`

Verified flows:
- board list/create/rename/archive
- invite create/list/revoke/validate/accept
- snapshot list/latest/get/create
- comments list/create/reply/resolve/reopen/delete
- voting session CRUD-style lifecycle + result retrieval
- publications list/create/rotate/revoke/resolve
- capabilities fetch and mapping
- auth header behavior
- concrete Java server URL and method shapes

### 2. Server WebSocket contract

Covered by:
- `src/collab/__tests__/javaWhiteboardServerWsContract.test.ts`

Verified flows:
- join URL construction for bearer-token joins
- join URL construction for invite-token joins
- `yourUserId -> userId` normalization
- uppercase permission to lowercase role normalization
- `from -> authorId` normalization
- presence fallback using `presentUserIds`
- non-fatal error payload handling
- timer-state / timer-control payload support
- reactions and richer ephemeral collaboration payload parsing

### 3. Real page-level workflows

Covered by:
- `src/pages/__tests__/boardEditorPage.workflows.test.tsx`
- `src/pages/__tests__/boardListPage.serverWorkflow.test.tsx`
- `src/pages/boardEditor/__tests__/FacilitationDialog.test.tsx`
- feature hook / panel tests for comments, voting, timer, capabilities, and reactions

Verified flows:
- unauthenticated invite link -> guest continuation -> editor shell
- authenticated invite link -> validate + accept -> editor shell
- server-backed authenticated board list load
- server-backed unauthenticated board list gate with sign-in action
- unified facilitation workspace tab routing
- comments, voting, timer, and reaction UX seams staying wired after integration

## Remaining limits of this verification

This pass gives a strong client-side safety net, but it is still not a true end-to-end environment test.

Still not covered automatically here:
- running against a live Quarkus server process
- running against a real OIDC provider
- browser-level canvas interaction behavior
- multi-tab or multi-browser collaboration timing
- anonymous/public publication route smoke testing against a live server
- persistence behavior across real server restarts

## Recommended manual smoke test sequence

When the Java server is available locally, verify these manually:

1. Sign in and load the board list.
2. Create a board and rename it.
3. Open the board and draw something.
4. Open **Facilitation** and add a comment to the board, then reply and resolve it.
5. Create a voting session, open it, cast votes from another session, and reveal the result.
6. Start a shared timer and confirm both participants see the same countdown.
7. Send quick reactions and verify bursts and participant activity are visible remotely.
8. Open **Share** and:
   - create an invite
   - list/revoke invites
   - create a publication
   - rotate/revoke a publication token
9. Refresh the page and confirm the latest snapshot reloads.
10. Open the invite link in another browser session:
   - once as authenticated user
   - once as guest
11. Confirm presence, remote edits, and ephemeral cues are visible.
12. Archive the board and confirm it disappears from the active list.

## Exit criteria for the client alignment pass

The client is considered aligned enough to move on when all of these are true:
- `npm test -- --runInBand` passes
- `npm run build` passes
- the REST contract tests pass
- the WebSocket contract tests pass
- the feature hook / panel tests pass
- the manual smoke test sequence succeeds against the current Java server build

## Final editor UX integration notes

- Facilitation-related functionality is now grouped into a unified workspace with Overview, Comments, Voting, and Timer tabs.
- Quick reactions remain directly available in the editor header for low-friction live collaboration.
- Share and access management remain in the dedicated Share dialog so invite/publication administration stays separate from facilitation flows.
- Capability-aware gating still controls whether tabs and actions appear, so the client remains safe against partially enabled server deployments.
