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
