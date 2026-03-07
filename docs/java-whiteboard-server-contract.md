# PWA Whiteboard ↔ java-whiteboard-server contract freeze

Last updated: 2026-03-07

This document freezes the **actual contract currently implemented by `java-whiteboard-server` and currently consumed by `pwa-whiteboard`**.

It is intentionally **descriptive, not aspirational**:
- field names match the server
- endpoint methods match the server
- known client/server drifts are called out explicitly instead of being hidden

## 1. Scope and intent

This contract freeze exists to give the client migration a stable baseline before deeper refactoring.

Source of truth used for this freeze:
- PWA client files under `src/api/*`, `src/collab/*`, `src/pages/hooks/useBoardCollaboration.ts`, and `shared/protocol/*`
- java-whiteboard-server REST resources under `src/main/java/.../api/*`
- java-whiteboard-server DTOs under `src/main/java/.../api/dto/*`
- java-whiteboard-server WebSocket message types under `src/main/java/.../ws/WsMessage.java`

## 2. Base URLs

### REST
Configured client base URL points at the server `/api` base.

Examples:
- `https://example.org/api`
- `http://localhost:8080/api`

### WebSocket
Configured client WebSocket base URL points at the server root, not `/api`.

Examples:
- `wss://example.org`
- `ws://localhost:8080`

Join path:
- `/ws/boards/{boardId}`

Auth is currently sent via query parameters because browser WebSocket APIs cannot set `Authorization` headers directly:
- authenticated join: `?access_token=...`
- invite join: `?invite=...`

## 3. Authentication expectations

### REST
Most board/snapshot/invite-management endpoints require a bearer token.

Client behavior:
- sends `Authorization: Bearer <token>` when an access token is available

### Invite validation
`POST /api/invites/validate` is public.

### Invite acceptance
`POST /api/invites/accept` requires authentication.
A guest can validate an invite anonymously, but accepting it into a persisted membership currently requires an authenticated user.

### WebSocket join
WebSocket join succeeds when either of these is true:
- authenticated access token grants board access
- invite token grants scoped access for that board

## 4. REST contract

## 4.1 Boards

### List boards
- Method: `GET`
- Path: `/api/boards`
- Auth: required
- Response: JSON array of `BoardResponse`

Example response item:

```json
{
  "id": "b1",
  "name": "Team board",
  "type": "whiteboard",
  "ownerUserId": "alice",
  "status": "active",
  "createdAt": "2026-03-01T10:00:00Z",
  "updatedAt": "2026-03-01T10:00:00Z"
}
```

### Create board
- Method: `POST`
- Path: `/api/boards`
- Auth: required
- Request body:

```json
{
  "name": "Team board",
  "type": "whiteboard"
}
```

- Response: created `BoardResponse`

### Get board
- Method: `GET`
- Path: `/api/boards/{id}`
- Auth: required
- Response: `BoardResponse`

### Update board metadata
- Method: `PATCH`
- Path: `/api/boards/{id}`
- Auth: required
- Request body:

```json
{
  "name": "Renamed board",
  "type": "whiteboard"
}
```

- Response: updated `BoardResponse`

### Archive board
- Method: `DELETE`
- Path: `/api/boards/{id}`
- Auth: required
- Response: `204 No Content`

### Current client alignment
The PWA client now calls **`PATCH /boards/{id}`** when renaming, which matches the Java server endpoint **`PATCH /api/boards/{id}`**.

Notes:
- the request body is still `{ name, type }`
- the client still sends the coarse server `type` as `"whiteboard"`
- richer client board type semantics are still persisted separately in local storage until a later step formalizes the end state

## 4.2 Snapshots

### Create snapshot
- Method: `POST`
- Path: `/api/boards/{boardId}/snapshots`
- Auth: required
- Request body:

```json
{
  "snapshot": { "meta": {}, "objects": [] }
}
```

Notes:
- `snapshot` must be valid JSON
- the server stores it as opaque JSON
- the client currently builds the payload from a JSON string and parses it before sending

### List snapshot versions
- Method: `GET`
- Path: `/api/boards/{boardId}/snapshots`
- Auth: required
- Response:

```json
{
  "versions": [1, 2, 3]
}
```

### Get latest snapshot
- Method: `GET`
- Path: `/api/boards/{boardId}/snapshots/latest`
- Auth: required
- Response shape is the same as `SnapshotResponse`

### Get snapshot by version
- Method: `GET`
- Path: `/api/boards/{boardId}/snapshots/{version}`
- Auth: required
- Response:

```json
{
  "boardId": "b1",
  "version": 3,
  "snapshot": { "meta": {}, "objects": [] },
  "createdAt": "2026-03-01T10:10:00Z",
  "createdBy": "alice"
}
```

## 4.3 Board invites

### Create invite
- Method: `POST`
- Path: `/api/boards/{boardId}/invites`
- Auth: required, owner only
- Request body:

```json
{
  "permission": "viewer",
  "expiresAt": "2026-04-01T00:00:00Z",
  "maxUses": 10
}
```

Only `permission` is required. `expiresAt` and `maxUses` are optional.

- Response:

```json
{
  "id": "inv1",
  "boardId": "b1",
  "permission": "viewer",
  "expiresAt": "2026-04-01T00:00:00Z",
  "maxUses": 10,
  "uses": 0,
  "revokedAt": null,
  "createdAt": "2026-03-01T10:20:00Z",
  "token": "secret-capability-token"
}
```

### List invites
- Method: `GET`
- Path: `/api/boards/{boardId}/invites`
- Auth: required, owner only
- Response: array of invite objects without the token

### Revoke invite
- Method: `DELETE`
- Path: `/api/boards/{boardId}/invites/{inviteId}`
- Auth: required, owner only
- Response: `204 No Content`

## 4.4 Public invite validation

### Validate invite
- Method: `POST`
- Path: `/api/invites/validate`
- Auth: not required
- Request body:

```json
{
  "token": "secret-capability-token"
}
```

- Response:

```json
{
  "valid": true,
  "reason": "OK",
  "boardId": "b1",
  "permission": "viewer",
  "expiresAt": "2026-04-01T00:00:00Z"
}
```

If invalid, the server still returns `200` with `valid: false` and a reason such as:
- `NOT_FOUND`
- `REVOKED`
- `EXPIRED`
- `MAX_USES_REACHED`

### Current client simplification
The current client only types a subset of the validation response:
- `valid`
- `permission`
- `expiresAt`
- `boardId`

It does **not** currently model `reason`, even though the server returns it.

## 4.5 Accept invite

### Accept invite into persisted membership
- Method: `POST`
- Path: `/api/invites/accept`
- Auth: required
- Request body:

```json
{
  "token": "secret-capability-token"
}
```

- Response:

```json
{
  "boardId": "b1",
  "role": "viewer"
}
```

Notes:
- role is server access role after acceptance
- editor invites map to role `editor`
- viewer invites map to role `viewer`

## 4.6 Me

### Get current user
- Method: `GET`
- Path: `/api/me`
- Auth: required
- Response:

```json
{
  "userId": "alice",
  "roles": ["whiteboard-user"]
}
```

## 5. WebSocket contract

## 5.1 Join URL

Path:
- `/ws/boards/{boardId}`

Query parameters:
- authenticated join: `access_token`
- invite join: `invite`

## 5.2 Server → client messages actually emitted by java-whiteboard-server

### joined

```json
{
  "type": "joined",
  "boardId": "b1",
  "yourUserId": "alice",
  "latestSnapshotVersion": 3,
  "latestSnapshot": { "meta": {}, "objects": [] },
  "users": [{ "userId": "alice", "joinedAt": "2026-03-01T10:30:00Z" }],
  "wsSessionId": "...",
  "correlationId": "..."
}
```

Important observations:
- actual field is `yourUserId`, not `userId`
- current server does **not** include `role` in the joined payload
- current server includes `users`, but those user objects may be minimal compared with richer client-side `PresenceUser`

### presence

```json
{
  "type": "presence",
  "boardId": "b1",
  "users": [{ "userId": "alice", "joinedAt": "2026-03-01T10:30:00Z" }]
}
```

### op

```json
{
  "type": "op",
  "boardId": "b1",
  "seq": 42,
  "from": "alice",
  "op": { "id": "evt1", "boardId": "b1", "type": "objectCreated", "timestamp": "...", "payload": {} }
}
```

### error

```json
{
  "type": "error",
  "code": "rate_limited",
  "message": "Too many messages"
}
```

## 5.3 Client → server messages currently used by the PWA

### op

```json
{
  "type": "op",
  "clientOpId": "cop_123",
  "baseSeq": 41,
  "op": { "id": "evt1", "boardId": "b1", "type": "objectCreated", "timestamp": "...", "payload": {} }
}
```

### ping
The shared protocol still allows a ping message, but current client behavior does not depend on it.

## 5.4 Current client simplifications and compatibility shims

The current PWA client deliberately accepts a somewhat broader protocol than the server currently emits.
This is visible in `shared/protocol/types.ts` and `shared/protocol/validation.ts`.

Compatibility shims currently in use:
- accept either `userId` or `yourUserId` in joined payloads
- accept either `authorId` or `from` in op payloads
- accept richer `PresenceUser` objects or minimal `{ userId }` objects
- default joined role to `editor` when the server does not provide one
- collaboration identity now derives authenticated self identity from `AuthContext.subject` (falling back to JWT `sub` only when needed)

These shims are useful during migration, but they are **not** the frozen actual server contract.
The actual server contract is the one documented above.

## 5.5 Board type end state (client decision)

The client now treats board type as a **domain/editor concern**, not as a direct mirror of the Java server's `board.type` field.

Current formalized end state:
- `WhiteboardMeta.boardType` is the canonical board type used by editor policies, toolbox composition, and imports/exports.
- persisted board snapshots/state remain the source of truth for that value.
- Java server `board.type` is treated as a coarse board kind and is currently sent as `whiteboard`.
- a local browser cache may retain board types for REST-backed board-list rendering, but that cache is only a read-model optimization.

Practical implication:
- when deciding editor behavior, always read `meta.boardType`, never `ServerBoard.type`.
- when talking to the current Java server board CRUD API, always send the coarse server kind, not the richer client board type.

## 6. Known drifts to resolve in later steps

1. **Joined payload naming drift**
   - client shared types prefer `userId`
   - server emits `yourUserId`

2. **Role availability drift in WebSocket join**
   - client models a joined role
   - server does not currently send role in the joined message

3. **Board type semantics are formally split for now**
   - client `boardType` (`advanced | freehand | mindmap`) is the canonical editor-policy value
   - server `board.type` is treated as a coarse board kind and currently remains `whiteboard`
   - canonical persistence for `boardType` is `WhiteboardMeta.boardType` inside snapshot/state payloads
   - the client may cache `boardType` locally for faster REST board-list rendering in the same browser
   - until the server exposes a first-class `boardType`, cross-device board lists may still temporarily show the fallback type before a snapshot is loaded on that device

4. **Invite validation response under-modeled on client**
   - server returns `reason`
   - current client type omits it

5. **Client presence sending is currently a no-op**
   - client API surface still exposes `sendPresence`
   - current Java server protocol is effectively join/op/error/presence-broadcast, not client-authored presence updates

## 7. Code locations added in this step

To make this contract freeze importable from code as well as readable in docs, this step adds:
- `src/api/javaWhiteboardServerContract.ts`
- `docs/java-whiteboard-server-contract.md`

The purpose is to let future steps replace scattered ad-hoc DTO types with one canonical client-side reference to the current server contract.
