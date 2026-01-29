# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Runtime and Package Manager

Default to using Bun instead of Node.js:
- Use `bun install` for dependencies
- Use `bun test` for running tests
- Use `bun <file>` to execute TypeScript files directly

## Monorepo Structure

This is a Bun workspace monorepo with the following packages:

### Packages
- **packages/covenant** (`@covenant/rpc`) - Core RPC framework with client, server, and type system
- **packages/react** (`@covenant/react`) - React hooks for Covenant (useQuery, useMutation, useListenedQuery, useCachedQuery)
- **packages/sidekick** (`@covenant/sidekick`) - Standalone WebSocket service for realtime channels and resource invalidation (allows edge deployments)
- **packages/request-serializer** (`@covenant/request-serializer`) - Utilities for serializing/deserializing Request objects
- **packages/ion** (`@covenant/ion`) - A superset of JSON used for communication (has support for `Date`, `Map`, etc.)
- **docs** - Astro-based documentation site

### Examples
- **examples/covenant-hello** - Minimal Next.js example showing basic query usage
- **examples/covenant-todo** - Full-featured example with NextAuth, Drizzle ORM, context/derivation patterns
- **examples/covenant-chat** - Demonstrates realtime channels and bidirectional communication

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
   - Create `CovenantClient` with the covenant
   - Provide `serverConnection` (typically `httpClientToServer()`)
   - Provide `sidekickConnection` (or `emptyClientToSidekick()` if not using channels)

### Key Modules in @covenant/rpc

- **lib/index.ts** - Core type definitions and `declareCovenant()`, `query()`, `mutation()`, `channel()` helpers
- **lib/server.ts** - `CovenantServer` class for handling RPC requests
- **lib/client.ts** - `CovenantClient` class for making RPC calls
- **lib/procedure.ts** - Procedure types, schemas, and inference utilities
- **lib/channel.ts** - Channel types and WebSocket message schemas
- **lib/validation.ts** - Internal validation library (not Standard Schema compliant, for internal use only)
- **lib/interfaces/** - Connection layer abstractions (http, direct, empty, mock)
- **lib/sidekick/** - Sidekick service internals for WebSocket management
- **lib/adapters/** - Framework adapters (vanilla adapter for Request → Response)

### Testing

- **Framework**: Bun's built-in test runner
- **Pattern**: Use `directClientToServer()` for in-memory testing (bypasses HTTP)
- **Pattern**: Use `emptyServerToSidekick()` and `emptyClientToSidekick()` when channels aren't needed
- **Location**: Tests are in `packages/*/tests/*.test.ts`
- **Run**: `bun test` from package directory or root

### Resource Tracking and Invalidation

Procedures define "resources" they touch:
- Mutations return resource identifiers (e.g., `["todo/123"]`)
- Clients with `listen()` or `useListenedQuery()` automatically refetch when their resources are updated
- Sidekick (optional) enables cross-client invalidation via WebSocket

### Context and Derivation

- **Context** (`contextGenerator`): Generated per-request, typically contains auth data
- **Derivation** (`derivation`): Functions available to all procedures, receives `ctx`, `error`, and `logger`
- **Pattern**: Use derivation for common operations like `forceAuthenticated()` that throws if not logged in

### Sidekick (Optional)

Sidekick is a separate service for handling:
- WebSocket connections (for realtime channels)
- Resource update notifications (for cross-client cache invalidation)
- Allows edge deployments (which can't run WebSockets) to delegate to origin

If not using realtime features, use `emptyServerToSidekick()` and `emptyClientToSidekick()`.

## Validation Libraries

Covenant supports any validation library implementing [Standard Schema](https://github.com/standard-schema/standard-schema):
- Zod (most common in examples)
- ArcType
- Other Standard Schema compliant libraries

Do NOT use `lib/validation.ts` from @covenant/rpc in user code - it's for internal framework use only.

## UI Patterns

Follow patterns in SKELETON_UI_PATTERNS.md:
- Extract common components that appear in loading, error, and success states
- Never repeat UI structures across different states
- Use conditional props (isLoading, isError) instead of duplicating components

## Development Workflow

- The monorepo uses Bun workspaces
- Install dependencies from root: `bun install`
- Examples use Next.js and have their own `package.json` with additional dependencies
- Changes to packages are immediately available to examples (workspace linking)
