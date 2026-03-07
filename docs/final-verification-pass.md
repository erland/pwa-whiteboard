# Final verification pass: pwa-whiteboard against java-whiteboard-server

Last updated: 2026-03-07

This verification pass is the final stabilization step after the client/server contract cleanup.

## Verified commands

Run these from the project root:

```bash
npm test -- --runInBand
npm run typecheck
npm run build
npm run verify
```

`npm run verify` is the one-command final gate for this client package.

## What the final verification now covers

### 1. Server REST contract

Covered by:
- `src/api/__tests__/javaWhiteboardServerIntegration.test.ts`

Verified flows:
- board list/create/rename/archive
- invite create/validate/accept
- snapshot list/latest/get/create
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

### 3. Real page-level workflows

Covered by:
- `src/pages/__tests__/boardEditorPage.workflows.test.tsx`
- `src/pages/__tests__/boardListPage.serverWorkflow.test.tsx`

Verified flows:
- unauthenticated invite link -> guest continuation -> editor shell
- authenticated invite link -> validate + accept -> editor shell
- server-backed authenticated board list load
- server-backed unauthenticated board list gate with sign-in action

## Remaining limits of this verification

This pass gives a strong client-side safety net, but it is still not a true end-to-end environment test.

Still not covered automatically here:
- running against a live Quarkus server process
- running against a real OIDC provider
- browser-level canvas interaction behavior
- multi-tab or multi-browser collaboration timing
- persistence behavior across real server restarts

## Recommended manual smoke test sequence

When the Java server is available locally, verify these manually:

1. Sign in and load the board list.
2. Create a board and rename it.
3. Open the board and draw something.
4. Refresh the page and confirm the latest snapshot reloads.
5. Create an invite as owner.
6. Open the invite link in another browser session:
   - once as authenticated user
   - once as guest
7. Confirm presence and remote edits are visible.
8. Archive the board and confirm it disappears from the active list.

## Exit criteria for the client alignment pass

The client is considered aligned enough to move on when all of these are true:
- `npm run verify` passes
- the REST contract tests pass
- the WebSocket contract tests pass
- the page workflow tests pass
- the manual smoke test sequence succeeds against the current Java server build
