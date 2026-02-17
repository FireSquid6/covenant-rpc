# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Runtime and Package Manager

Use Bun instead of Node.js:
- `bun install` - install dependencies
- `bun test` - run tests
- `bun <file>` - execute TypeScript files directly

## Monorepo Structure

Bun workspace monorepo. Workspaces are `packages/*`, `examples/*`, and `e2e-test`.

### Packages

- **packages/core** (`@covenant-rpc/core`) - Shared type definitions, connection interfaces, `declareCovenant()`, `query()`, `mutation()`, `channel()` helpers. Zero runtime dependencies (only `@standard-schema/spec`).
- **packages/server** (`@covenant-rpc/server`) - `CovenantServer` class, Sidekick service (WebSocket + resource invalidation), adapters, and all server-side connection implementations.
- **packages/client** (`@covenant-rpc/client`) - `CovenantClient` class for RPC calls, resource listening, and cache invalidation.
- **packages/react** (`@covenant-rpc/react`) - React hooks (`useQuery`, `useMutation`, `useListenedQuery`, `useCachedQuery`) via `CovenantReactClient` extending `CovenantClient`.
- **packages/ion** (`@covenant-rpc/ion`) - Custom JSON-like serialization format supporting Dates, Maps, Sets, NaN, Infinity. Used for all RPC message serialization.
- **packages/request-serializer** (`@covenant-rpc/request-serializer`) - Serialize/deserialize Web `Request` objects to JSON.

### Root Scripts

- `bun run test:all` - Typecheck + run all package tests + e2e tests
- `bun run test:e2e` - Run e2e tests only
- `bun run build:all` - Build all packages
- `bun run publish` - Publish packages

The `test:all` script typechecks the root and each package with `tsc --noEmit` before running `bun test`, then runs e2e tests last.

## Core Architecture

### The Covenant Pattern

Strict separation of frontend and backend via a shared covenant definition:

1. **Covenant Definition** (shared, isolated file):
   - `declareCovenant()` with `procedures` and `channels`
   - `query()` and `mutation()` for procedure declarations
   - `channel()` for realtime channel declarations
   - Only import validation schemas (Zod, etc.) — NEVER import backend code

2. **Server Implementation** (backend only):
   - Create `CovenantServer` with the covenant
   - Provide `contextGenerator` (auth data from request)
   - Provide `derivation` (utility functions available to all procedures, receives `ctx`, `error`, `logger`)
   - `defineProcedure()` for each procedure, `defineChannel()` for each channel
   - `assertAllDefined()` to verify complete implementation

3. **Client Setup** (frontend only):
   - Create `CovenantClient` (or `CovenantReactClient` for React)
   - Provide `serverConnection` (typically `httpClientToServer()`)
   - Provide `sidekickConnection` (or `emptyClientToSidekick()` if not using channels/resources)

### Key Modules by Package

**@covenant-rpc/core** (`packages/core/`):
- `index.ts` - `declareCovenant()`, `query()`, `mutation()`, `channel()`
- `procedure.ts` - Procedure types, schemas, inference utilities (`InferProcedureInputs`, `InferProcedureOutputs`)
- `channel.ts` - Channel types, message schemas, inference utilities (`InferChannelServerMessage`, `InferChannelClientMessage`, `InferChannelParams`)
- `interfaces.ts` - Four connection interface definitions
- `validation.ts` - Internal validation library (NOT Standard Schema, internal use only)
- `utils.ts` - `MaybePromise`, `Result<T>`, `AsyncResult<T>`, `ok()`, `err()`, `MultiTopicPubsub`
- `errors.ts` - `ThrowableProcedureError`, `ThrowableChannelError`, error conversion helpers
- `logger.ts` - `Logger` interface definition (`LoggerLevel`: silent/error/warn/info/debug)
- `sidekick/protocol.ts` - Sidekick wire protocol schemas and topic naming utilities

**@covenant-rpc/server** (`packages/server/`):
- `server.ts` - `CovenantServer` class with `handle(request)`, `defineProcedure()`, `defineChannel()`, `sendMessage()`, `assertAllDefined()`
- `logger.ts` - Logger implementation with prefix system and log levels
- `adapters/vanilla.ts` - `vanillaAdapter(server)` wrapping `server.handle()`
- `interfaces/direct.ts` - `directClientToServer()` for in-memory testing (bypasses HTTP)
- `interfaces/empty.ts` - `emptyServerToSidekick()` no-op connection
- `interfaces/http.ts` - `httpServerToSidekick()`, `httpSidekickToServer()`
- `interfaces/mock.ts` - `mockServerToSidekick()` for testing with real Sidekick
- `sidekick/index.ts` - `Sidekick` class (resource/channel pub/sub logic)
- `sidekick/internal.ts` - `InternalSidekick` for in-memory testing without HTTP
- `sidekick/webserver.ts` - HTTP + WebSocket server using `ws` and `node:http`
- `sidekick/handlers.ts` - WebSocket message handlers
- `bin/sidekick.ts` - CLI executable for standalone Sidekick service

**@covenant-rpc/client** (`packages/client/`):
- `client.ts` - `CovenantClient` with `query()`, `mutate()`, `connect()`, `send()`, `subscribe()`, `listen()`
- `interfaces/http.ts` - `httpClientToServer()` (HTTP POST with ION), `httpClientToSidekick()` (WebSocket with auto-reconnect and message queuing)
- `interfaces/empty.ts` - `emptyClientToSidekick()`, `emptyClientToServer()` no-op stubs

**@covenant-rpc/react** (`packages/react/`):
- `index.ts` - `CovenantReactClient` with hooks:
  - `useQuery` - Auto-executes on mount/input change
  - `useMutation` - Manual execution with optional optimistic updates
  - `useListenedQuery` - Auto-refetches on resource invalidation
  - `useCachedQuery` - Shared cache state across components

### Testing

- **Framework**: Bun's built-in test runner (`bun:test`)
- **Location**: `packages/*/tests/*.test.ts` and `packages/ion/index.test.ts`, `packages/request-serializer/index.test.ts`
- **E2E**: `e2e-test/e2e.test.ts`

Key testing patterns:
- Use `directClientToServer()` for in-memory procedure testing (bypasses HTTP)
- Use `emptyServerToSidekick()` and `emptyClientToSidekick()` when channels aren't needed
- Use `InternalSidekick` (from `packages/server/sidekick/internal.ts`) for in-memory channel testing

E2E test structure (`e2e-test/`):
- `covenant.ts` - Shared covenant definition
- `server.ts` - `startCovenant()` starts HTTP server
- `sidekick.ts` - `startSidekick()` starts standalone Sidekick
- `client.ts` - `getNewClient()` creates HTTP client

### Connection Interfaces

Four pluggable connection interfaces in `@covenant-rpc/core/interfaces.ts`:

| Interface | For testing | For production |
|---|---|---|
| `ClientToServerConnection` | `directClientToServer()` | `httpClientToServer()` |
| `ClientToSidekickConnection` | `emptyClientToSidekick()` | `httpClientToSidekick()` |
| `ServerToSidekickConnection` | `emptyServerToSidekick()` | `httpServerToSidekick()` |
| `SidekickToServerConnection` | — | `httpSidekickToServer()` |

### Resource Tracking and Invalidation

- Mutations return resource identifiers (e.g., `["todo/123"]`)
- Clients using `listen()` or `useListenedQuery()` auto-refetch when their resources are updated
- Sidekick (optional) enables cross-client invalidation via WebSocket

### Sidekick

Sidekick (bundled in `@covenant-rpc/server`) handles:
- WebSocket connections for realtime channels
- Resource update broadcast for cross-client cache invalidation
- Can be delegated to origin from edge deployments that can't run WebSockets

Run standalone via `covenant-sidekick` CLI or `bun packages/server/bin/sidekick.ts`.

CLI options (also available as env vars):
- `--port` / `SIDEKICK_PORT`
- `--secret` / `SIDEKICK_SECRET`
- `--auth-delay` / `SIDEKICK_AUTH_DELAY`
- `--server-url` / `SIDEKICK_SERVER_URL`
- `--server-secret` / `SIDEKICK_SERVER_SECRET`

If not using realtime features, use `emptyServerToSidekick()` and `emptyClientToSidekick()`.

### ION Serialization

ION (`@covenant-rpc/ion`) is used throughout instead of JSON. It adds support for:
- `Date` → `"date:<ISO_STRING>"`
- `Map` → `"map { k: v }"`
- `Set` → `"set { v }"`
- `NaN`, `Infinity`, `-Infinity`
- Circular reference detection and prototype pollution prevention

### Error Handling

- Procedures: throw `ThrowableProcedureError(message, httpCode)` — converts to HTTP error responses
- Channels: throw `ThrowableChannelError(message, channel, params, cause)` — rejects connection
- Unknown errors are converted via `procedureErrorFromUnknown()` / `channelErrorFromUnknown()`

## Validation Libraries

Covenant supports any [Standard Schema](https://github.com/standard-schema/standard-schema) compliant library. Zod is used in all examples and tests.

Do NOT use `validation.ts` from `@covenant-rpc/core` in user code — it's an internal zero-dependency validator for framework internals only.

## TypeScript Configuration

- `tsconfig.json` — no-emit, `allowImportingTsExtensions: true` (for direct `.ts` imports in workspace)
- `tsconfig.build.json` — emits `.d.ts`, `.d.ts.map`, `.js.map` for package publishing

## Development Workflow

- Install from root: `bun install`
- Changes to packages are immediately reflected via workspace linking
- CI (GitHub Actions): install → test:all → build:all
