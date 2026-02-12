# Integration Tests for Sidekick Webserver

## Context
The sidekick webserver (`packages/server/sidekick/webserver.ts`) was recently rewritten to use the `ws` library with `node:http`. It has HTTP endpoints and a WebSocket endpoint but no dedicated tests. The existing `sidekick.test.ts` only tests the `Sidekick` class in isolation (publish function calls). We need integration tests that start the actual HTTP+WS server and verify end-to-end behavior.

## Plan

Create `/home/firesquid/source/covenant-rpc/packages/server/tests/webserver.test.ts`

### Test Helpers
- `startTestServer(secret)` — calls `startSidekickServer` on a random port, returns `{ server, port, url, close() }`
- `connectWs(port)` — opens a `ws.WebSocket` to `ws://localhost:${port}/socket`, returns a promise that resolves when open
- `sendWsAndWaitForReply(ws, message)` — sends an ION-encoded message and returns the first ION-decoded response
- `postEndpoint(port, path, body, secret, useION?)` — makes an HTTP POST with Bearer auth, returns the response

### Test Cases

**HTTP Endpoint Tests**
1. **Auth rejection** — POST `/resources` without correct Bearer token returns 401
2. **POST /resources** — sends `{ resources: ["a", "b"] }` with correct auth, gets 200
3. **POST /connection** — sends ION-encoded `ChannelConnectionPayload`, gets 200
4. **POST /message** — sends ION-encoded `ServerMessage`, gets 200 (and connected+subscribed WS client receives it)
5. **404 for unknown routes** — GET or POST to unknown path returns 404

**WebSocket Tests**
6. **WS connect on /socket** — client connects successfully
7. **WS rejected on wrong path** — connection to `/other` is destroyed
8. **listen/unlisten** — send `{ type: "listen", resources: ["r1"] }`, receive `{ type: "listening", resources: ["r1"] }`. Then unlisten and verify response.
9. **Resource update broadcast** — client listens to resource "x", server POSTs `/resources` with `["x"]`, client receives `{ type: "updated", resource: "x" }`
10. **subscribe/unsubscribe** — register a connection token via POST `/connection`, then WS client sends `{ type: "subscribe", token }`, receives `{ type: "subscribed", ... }`. Then unsubscribe and verify.
11. **Channel message broadcast** — client subscribes to a channel, server POSTs `/message` with matching channel/params, client receives the message
12. **Invalid WS message** — send malformed ION, receive error response with `fault: "client"`

### Key Files
- **Test file**: `packages/server/tests/webserver.test.ts` (new)
- **Implementation**: `packages/server/sidekick/webserver.ts`
- **Imports**: `ws` (WebSocket client), `ION` from `@covenant-rpc/ion`, `startSidekickServer` from `../sidekick/webserver`

### Verification
- Run `bun run test:all` — all packages should pass
