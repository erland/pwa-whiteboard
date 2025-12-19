# Collaboration Worker (Cloudflare Workers + Durable Objects)

This package hosts the collaboration backend for the whiteboard app.

## What it is (Step 4)
- A Cloudflare Worker that routes `GET /collab/:boardId` requests to a Durable Object instance.
- A Durable Object (`BoardRoom`) that accepts WebSocket upgrades and maintains a set of connected clients.

In Step 4 the server only echoes/broadcasts incoming messages so you can verify connectivity.
Later steps add authentication, invite validation, ordered ops, persistence, etc.

## Local development (basic)
1) Install Wrangler (one-time):
   - `npm i -g wrangler`  (or use `npx wrangler`)

2) From the repo root:
   - `cd workers/collab`
   - `npx wrangler dev`

3) Connect to:
   - `ws://127.0.0.1:8787/collab/<boardId>`

You should receive a JSON `hello` message on connect.

## Deploy
From `workers/collab`:
- `npx wrangler deploy`

## Configuration
See `wrangler.toml` for environment variables. Secrets must be set via:
- `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`


## Step 5: Join/auth validation

This worker now requires the first message on the WebSocket to be a `join` message matching the shared protocol.

Example (browser console):

```js
const ws = new WebSocket('ws://127.0.0.1:8787/collab/<boardId>');
ws.onmessage = (e) => console.log('msg', e.data);
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'join',
    boardId: '<boardId>',
    auth: { kind: 'invite', inviteToken: '<token>' },
    client: { displayName: 'Guest', color: '#38bdf8' }
  }));
};
```
