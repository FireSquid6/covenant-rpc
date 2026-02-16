# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Runtime and Package Manager

Default to using Bun instead of Node.js:
- Use `bun install` for dependencies
- Use `bun test` for running tests
- Use `bun <file>` to execute TypeScript files directly

## Monorepo Structure

This is a Bun workspace monorepo. Workspaces are `packages/*` and `examples/*`.

### Packages

The framework is split across several `@covenant-rpc/*` scoped packages:

- **packages/core** (`@covenant-rpc/core`) - Shared type definitions, validation schemas, connection interfaces, and `declareCovenant()`, `query()`, `mutation()`, `channel()` helpers. Zero runtime dependencies (only `@standard-schema/spec`).
- **packages/server** (`@covenant-rpc/server`) - `CovenantServer` class, procedure/channel handling, adapters, Sidekick service (WebSocket + resource invalidation), and all server-side connection implementations.
- **packages/client** (`@covenant-rpc/client`) - `CovenantClient` class for making RPC calls, resource listening, and cache invalidation. Includes HTTP and empty connection implementations.
- **packages/react** (`@covenant-rpc/react`) - React hooks (`useQuery`, `useMutation`, `useListenedQuery`, `useCachedQuery`) via `CovenantReactClient` which extends `CovenantClient`.
- **packages/ion** (`@covenant-rpc/ion`) - Custom JSON-like serialization format supporting Dates, Maps, Sets, NaN, Infinity. Used throughout for all RPC message serialization.
- **packages/request-serializer** (`@covenant-rpc/request-serializer`) - Utilities for serializing/deserializing Web Request objects to JSON.

### Root Scripts

- `bun run test:all` - Run all package tests in parallel
- `bun run build:all` - Build all packages
- `bun run publish` - Publish packages
- `bun run update` - Update utility

## Core Architecture

### The Covenant Pattern

The fundamental pattern is strict separation of frontend and backend via a shared "covenant" definition:

1. **Covenant Definition** (shared): Define the contract in an isolated file
   - Use `declareCovenant()` with `procedures` and `channels`
   - Use `query()` and `mutation()` for procedure declarations
   - Use `channel()` for realtime channel declarations
   - Only import validation schemas (like Zod schemas or Drizzle table schemas)
   - NEVER import backend implementation code

2. **Server Implementation** (backend only):
   - Create `CovenantServer` with the covenant
   - Provide `contextGenerator` (e.g., auth data from request)
   - Provide `derivation` (utility functions available to all procedures)
   - Use `defineProcedure()` to implement each procedure
   - Use `defineChannel()` to implement channel handlers
   - Call `assertAllDefined()` to ensure all procedures are implemented

3. **Client Setup** (frontend only):
   - Create `CovenantClient` (or `CovenantReactClient` for React) with the covenant
   - Provide `serverConnection` (typically `httpClientToServer()`)
   - Provide `sidekickConnection` (or `emptyClientToSidekick()` if not using channels)

### Key Modules by Package

**@covenant-rpc/core** (`packages/core/`):
- `index.ts` - Core type definitions, `declareCovenant()`, `query()`, `mutation()`, `channel()`
- `procedure.ts` - Procedure types, schemas, and inference utilities
- `channel.ts` - Channel types and WebSocket message schemas
- `interfaces.ts` - Connection interface definitions (`ClientToServerConnection`, `ClientToSidekickConnection`, `ServerToSidekickConnection`, `SidekickToServerConnection`)
- `validation.ts` - Internal validation library (NOT Standard Schema, for internal use only)
- `utils.ts` - `MaybePromise`, `Result<T>`, `MultiTopicPubsub`, error helpers
- `errors.ts` - `ThrowableProcedureError`, `ThrowableChannelError`
- `logger.ts` - Logger interface definition

**@covenant-rpc/server** (`packages/server/`):
- `server.ts` - `CovenantServer` class (handle requests, define procedures/channels)
- `logger.ts` - Logger implementation with prefixes and levels
- `adapters/vanilla.ts` - Request → Response adapter wrapping `server.handle()`
- `interfaces/http.ts` - `httpServerToSidekick`, `httpSidekickToServer`
- `interfaces/direct.ts` - In-memory connection (for testing, bypasses HTTP)
- `interfaces/empty.ts` - No-op Sidekick connection
- `interfaces/mock.ts` - Mock connection for testing
- `sidekick/index.ts` - `Sidekick` class (resource/channel pub/sub logic)
- `sidekick/webserver.ts` - HTTP + WebSocket server using `ws` and `node:http`
- `sidekick/handlers.ts` - WebSocket message handlers
- `bin/sidekick.ts` - CLI executable for standalone Sidekick service

**@covenant-rpc/client** (`packages/client/`):
- `client.ts` - `CovenantClient` class (query, mutate, connect, listen, send)
- `interfaces/http.ts` - `httpClientToServer()` (HTTP POST with ION), `httpClientToSidekick()` (WebSocket with auto-reconnect)
- `interfaces/empty.ts` - No-op stubs

**@covenant-rpc/react** (`packages/react/`):
- `index.ts` - `CovenantReactClient` extending `CovenantClient` with React hooks

### Testing

- **Framework**: Bun's built-in test runner (`bun:test`)
- **Pattern**: Use `directClientToServer()` for in-memory testing (bypasses HTTP)
- **Pattern**: Use `emptyServerToSidekick()` and `emptyClientToSidekick()` when channels aren't needed
- **Location**: Tests are in `packages/*/tests/*.test.ts`
- **Run**: `bun test` from a package directory, or `bun run test:all` from root
- **Test files**:
  - `packages/server/tests/` - procedure, channel, channel-http, sidekick, webserver, validation, validation-types tests
  - `packages/react/tests/hooks.test.tsx` - React hook tests
  - `packages/ion/index.test.ts` - ION serialization tests
  - `packages/request-serializer/index.test.ts` - Request serialization tests

### Connection Interfaces

Four pluggable connection interfaces defined in `@covenant-rpc/core/interfaces.ts`:

- **ClientToServerConnection** - Implementations: `httpClientToServer()` (client), `directClientToServer()` (server, for testing)
- **ClientToSidekickConnection** - Implementations: `httpClientToSidekick()` (client), `emptyClientToSidekick()` (client)
- **ServerToSidekickConnection** - Implementations: `httpServerToSidekick()` (server), `emptyServerToSidekick()` (server)
- **SidekickToServerConnection** - Implementations: `httpSidekickToServer()` (server)

### Resource Tracking and Invalidation

Procedures define "resources" they touch:
- Mutations return resource identifiers (e.g., `["todo/123"]`)
- Clients with `listen()` or `useListenedQuery()` automatically refetch when their resources are updated
- Sidekick (optional) enables cross-client invalidation via WebSocket

### Context and Derivation

- **Context** (`contextGenerator`): Generated per-request, typically contains auth data
- **Derivation** (`derivation`): Functions available to all procedures, receives `ctx`, `error`, and `logger`
- **Pattern**: Use derivation for common operations like `forceAuthenticated()` that throws if not logged in

### Sidekick

Sidekick is a service bundled in `@covenant-rpc/server` for handling:
- WebSocket connections (for realtime channels)
- Resource update notifications (for cross-client cache invalidation)
- Allows edge deployments (which can't run WebSockets) to delegate to origin
- Can be run standalone via `covenant-sidekick` CLI or `bun packages/server/bin/sidekick.ts`

If not using realtime features, use `emptyServerToSidekick()` and `emptyClientToSidekick()`.

### ION Serialization

ION (`@covenant-rpc/ion`) is a custom serialization format used throughout the framework instead of JSON. It extends JSON with support for:
- `Date` objects (serialized as `date:ISO_STRING`)
- `Map` and `Set` (serialized as `map { k: v }` and `set { v }`)
- `NaN` and `Infinity`
- Circular reference detection and prototype pollution prevention

## Validation Libraries

Covenant supports any validation library implementing [Standard Schema](https://github.com/standard-schema/standard-schema):
- Zod (most common in examples)
- ArcType
- Other Standard Schema compliant libraries

Do NOT use `validation.ts` from `@covenant-rpc/core` in user code - it's for internal framework use only.

## Development Workflow

- The monorepo uses Bun workspaces
- Install dependencies from root: `bun install`
- Changes to packages are immediately available to other packages (workspace linking)
- CI runs via GitHub Actions: install, test all, build all
