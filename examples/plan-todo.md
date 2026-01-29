# Covenant Todo Example - Implementation Plan

## Overview
A full-featured todo application demonstrating Covenant RPC with Sidekick for automatic cache invalidation and resource tracking. Shows how mutations trigger automatic refetches across components.

## Project Structure
```
examples/covenant-todo/
├── src/
│   ├── covenant.ts                 # Shared covenant definition
│   ├── server/
│   │   ├── server.ts               # CovenantServer with Sidekick
│   │   ├── auth.ts                 # Authentication utilities
│   │   └── db.ts                   # Drizzle setup with SQLite
│   ├── client/
│   │   └── client.ts               # CovenantReactClient with Sidekick
│   └── app/                        # Next.js app directory
│       ├── layout.tsx              # Root layout
│       ├── page.tsx                # Todo list with useListenedQuery
│       ├── login/
│       │   └── page.tsx            # Login page
│       └── api/
│           └── covenant/
│               └── route.ts        # API route handler
├── tests/
│   ├── unit/
│   │   ├── procedures.test.ts     # Unit tests for all procedures
│   │   └── resources.test.ts      # Test resource tracking
│   ├── integration/
│   │   ├── server.test.ts         # Integration tests
│   │   └── invalidation.test.ts   # Test automatic refetch
│   └── e2e/
│       └── todo.spec.ts           # Playwright e2e tests
├── drizzle/
│   └── schema.ts                  # Database schema (users + todos)
├── playwright.config.ts           # Playwright configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Tech Stack
- **Runtime**: Bun
- **Framework**: Next.js 14+ (App Router)
- **UI**: React 18+
- **Database**: SQLite with Drizzle ORM
- **Testing**: Bun test + Playwright
- **RPC**: Covenant (@covenant/core, @covenant/server, @covenant/client, @covenant/react, @covenant/sidekick)
- **Sidekick**: InternalSidekick for resource tracking

## Feature Requirements

### 1. Authentication (Same as Hello World)
- Simple username/password system
- Login procedure that returns a token
- Context generator that validates token

### 2. Todo CRUD Procedures
- `getTodos` query: Get all todos for authenticated user
  - Input: none (uses user from context)
  - Output: array of todos
  - Resource: `todos/user/${userId}`

- `createTodo` mutation: Create a new todo
  - Input: `{ title: string }`
  - Output: created todo
  - Resource: `todos/user/${userId}`, `todo/${todoId}`

- `updateTodo` mutation: Update todo title and/or completed status
  - Input: `{ id: string, title?: string, completed?: boolean }`
  - Output: updated todo
  - Resource: `todos/user/${userId}`, `todo/${todoId}`

- `deleteTodo` mutation: Delete a todo
  - Input: `{ id: string }`
  - Output: `{ success: boolean }`
  - Resource: `todos/user/${userId}`, `todo/${todoId}`

### 3. Sidekick Integration
- Use `InternalSidekick` to enable resource tracking
- Server connects with `sidekick.getConnectionFromServer()`
- Client connects with `sidekick.getConnectionFromClient()`
- Set server callback with `sidekick.setServerCallback()`

### 4. UI Components
- Login page (reuse from hello world)
- Todo list page with:
  - useListenedQuery to auto-refetch when todos change
  - Form to add new todo
  - Todo items with checkbox (toggle completed) and delete button
  - Filter by all/active/completed
  - Show loading and error states
- Logout functionality

### 5. Testing Coverage
- **Unit tests**: Test all procedures in isolation
- **Resource tests**: Verify correct resource identifiers returned
- **Invalidation tests**: Test that mutations trigger refetch
- **Integration tests**: Test full CRUD flow
- **E2E tests**: Test UI interactions and auto-updates

## Implementation Steps

### Step 1: Project Setup
1. Create directory structure
2. Initialize package.json with dependencies (add @covenant/sidekick)
3. Create tsconfig.json
4. Create playwright.config.ts

### Step 2: Database Schema
1. Create drizzle/schema.ts with:
   - users table (id, username, password)
   - todos table (id, userId, title, completed, createdAt)
   - Foreign key from todos.userId to users.id
2. Create drizzle.config.ts
3. Set up database connection in src/server/db.ts

### Step 3: Covenant Definition
1. Create src/covenant.ts with:
   - `login` mutation (reuse from hello world)
   - `getTodos` query
   - `createTodo` mutation
   - `updateTodo` mutation
   - `deleteTodo` mutation
2. All procedures properly typed with Zod schemas

### Step 4: Server Implementation with Sidekick
1. Create src/server/auth.ts (reuse from hello world)
2. Create src/server/server.ts:
   - Initialize `InternalSidekick`
   - Create `CovenantServer` with:
     - contextGenerator (validate token → user)
     - derivation with `requireAuth()` and database
     - sidekickConnection: `sidekick.getConnectionFromServer()`
   - Set server callback:
     ```typescript
     sidekick.setServerCallback((channelName, params, data, context) =>
       server.processChannelMessage(channelName, params, data, context)
     );
     ```
   - Define all procedures with proper resource tracking:
     - `getTodos`: resources = `[`todos/user/${userId}`]`
     - `createTodo`: resources = `[`todos/user/${userId}`, `todo/${output.id}`]`
     - `updateTodo`: resources = `[`todos/user/${userId}`, `todo/${input.id}`]`
     - `deleteTodo`: resources = `[`todos/user/${userId}`, `todo/${input.id}`]`
   - Call `assertAllDefined()`

### Step 5: Client Setup with Sidekick
1. Create src/client/client.ts:
   - Initialize same `InternalSidekick` instance (or separate for different clients)
   - Create `CovenantReactClient` with:
     - serverConnection: `directClientToServer(server, ...)` or `httpClientToServer(...)`
     - sidekickConnection: `sidekick.getConnectionFromClient()`
   - Auth token management

### Step 6: Next.js API Route
1. Create src/app/api/covenant/route.ts:
   - Export POST handler that calls server.handle(request)

### Step 7: UI Components
1. Create src/app/layout.tsx
2. Create src/app/login/page.tsx (reuse from hello world)
3. Create src/app/page.tsx with:
   - `useListenedQuery('getTodos', null)` - automatically refetches when todos change
   - Form to create new todo (call `client.mutate('createTodo')`)
   - Map over todos showing:
     - Checkbox (call `client.mutate('updateTodo')` to toggle completed)
     - Title (click to edit, blur to save)
     - Delete button (call `client.mutate('deleteTodo')`)
   - Filter buttons (all/active/completed)
   - Loading and error states
4. Key pattern: When any mutation runs (create/update/delete), getTodos automatically refetches

### Step 8: Unit Tests
1. Create tests/unit/procedures.test.ts:
   - Test each procedure independently using `directClientToServer`
   - Test success paths
   - Test error paths (e.g., delete non-existent todo)
   - Test authentication requirements

2. Create tests/unit/resources.test.ts:
   - Verify each procedure returns correct resource identifiers
   - Test with different inputs to ensure resource patterns are correct

### Step 9: Integration Tests
1. Create tests/integration/server.test.ts:
   - Test full CRUD flow: create → read → update → delete
   - Test with real database
   - Test multiple users don't see each other's todos

2. Create tests/integration/invalidation.test.ts:
   - **Critical test**: Verify automatic refetch behavior
   - Use `client.listen('getTodos', null, callback)`
   - Track callback invocations
   - Perform mutations and verify callback triggered with fresh data
   - Test both local (same client) and potentially remote (different client) invalidation

### Step 10: E2E Tests
1. Create tests/e2e/todo.spec.ts:
   - Test: Login → add todo → see it in list
   - Test: Toggle todo completed → verify UI updates
   - Test: Delete todo → verify removed from list
   - Test: Add todo in one session → verify appears in another session (if testing remote invalidation)
   - Test: Filter todos by active/completed

### Step 11: Documentation
1. Create README.md with:
   - Setup instructions
   - Architecture explanation focusing on:
     - Sidekick setup
     - Resource tracking pattern
     - Automatic cache invalidation
   - How mutations trigger refetches
   - Diagram of resource flow

## Key Patterns to Demonstrate

### 1. Resource Tracking Pattern
```typescript
// Server declares resources
server.defineProcedure('createTodo', {
  resources: ({ inputs, outputs, ctx }) => [
    `todos/user/${ctx.user.id}`,  // Collection
    `todo/${outputs.id}`,          // Specific item
  ],
  procedure: async ({ inputs, derived }) => {
    // ... create todo
  },
});
```

### 2. Automatic Cache Invalidation
```typescript
// Client uses listened query
const todos = client.useListenedQuery('getTodos', null);

// When this mutation runs...
await client.mutate('createTodo', { title: 'New todo' });

// ...getTodos automatically refetches because they share resources!
```

### 3. Sidekick Setup Pattern
```typescript
// Server side
const sidekick = new InternalSidekick();
sidekick.setServerCallback((channelName, params, data, context) =>
  server.processChannelMessage(channelName, params, data, context)
);

const server = new CovenantServer(covenant, {
  sidekickConnection: sidekick.getConnectionFromServer(),
  // ...
});

// Client side
const client = new CovenantClient(covenant, {
  sidekickConnection: sidekick.getConnectionFromClient(),
  // ...
});
```

### 4. Resource Naming Strategy
- Use hierarchical names: `todos/user/${userId}` for collections
- Use specific IDs: `todo/${id}` for individual items
- Mutations declare both to invalidate list AND detail views

## Testing Strategy

### Unit Tests
- Test procedures return correct data
- Test procedures return correct resources
- Verify authentication guards work
- Test edge cases (empty lists, invalid IDs)

### Integration Tests
- **Critical**: Test automatic refetch behavior
- Test resource invalidation across procedures
- Test with real Sidekick instance
- Test multiple clients

### E2E Tests
- Test real UI interactions
- Verify optimistic updates (if implemented)
- Test filter functionality
- Test error states

## Dependencies

```json
{
  "dependencies": {
    "@covenant/core": "workspace:*",
    "@covenant/server": "workspace:*",
    "@covenant/client": "workspace:*",
    "@covenant/react": "workspace:*",
    "@covenant/sidekick": "workspace:*",
    "@covenant/ion": "workspace:*",
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "drizzle-orm": "latest",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "drizzle-kit": "latest",
    "@playwright/test": "^1.40.0",
    "playwright": "^1.40.0"
  }
}
```

## Success Criteria

- ✅ User can create, read, update, delete todos
- ✅ Todo list automatically updates when mutations occur
- ✅ Multiple components using useListenedQuery stay in sync
- ✅ Resource tracking works correctly
- ✅ All unit tests pass (procedures + resources)
- ✅ All integration tests pass (CRUD + invalidation)
- ✅ All e2e tests pass
- ✅ Code follows Covenant patterns from guide.md
- ✅ README clearly explains Sidekick and resource tracking

## Potential Covenant Issues to Watch For

- InternalSidekick initialization and callback setup
- Resource identifier consistency
- Listen callback invocation timing
- Resource tracking with async operations
- Sidekick connection lifecycle
- Remote vs local invalidation behavior
- Type inference through resource generics

## Key Differences from Hello World

1. **Sidekick**: Hello world used `emptyServerToSidekick()`, this uses real Sidekick
2. **Multiple Procedures**: More complex covenant with 5 procedures
3. **Resource Tracking**: Demonstrates the core value proposition of Covenant
4. **useListenedQuery**: Shows automatic refetch behavior
5. **CRUD Pattern**: Complete create/read/update/delete flow
6. **Relational Data**: Todos belong to users (foreign key)
