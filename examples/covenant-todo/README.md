# Covenant Todo Example

A full-featured todo application demonstrating **Covenant RPC's automatic cache invalidation** through resource tracking and Sidekick integration.

## Key Features Demonstrated

- **Automatic Cache Invalidation**: When mutations run, queries listening to the same resources automatically refetch
- **Resource Tracking**: Procedures declare which resources they touch, enabling smart cache invalidation
- **InternalSidekick**: Enables cross-client resource invalidation without deploying a separate service
- **useListenedQuery**: React hook that automatically updates when data changes
- **Full CRUD**: Complete create, read, update, delete operations
- **Authentication**: Simple session-based auth demonstrating context patterns

## The Core Value Proposition

The primary feature this example showcases is **automatic cache invalidation through resource tracking**:

```typescript
// In your component - useListenedQuery automatically refetches on changes
const todos = client.useListenedQuery('getTodos', null);

// When this mutation runs...
await client.mutate('createTodo', { title: 'New todo' });

// ...getTodos automatically refetches because they share resources!
// No manual refetch needed!
```

This works because:

1. **Server declares resources** that each procedure touches
2. **Mutations return resource identifiers** when they modify data
3. **Queries listen to resources** and automatically refetch when they change
4. **Sidekick coordinates** the invalidation across clients

## Architecture

### Resource Tracking Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Resource Tracking Flow                   │
└─────────────────────────────────────────────────────────────┘

1. Client calls mutation (createTodo)
   ↓
2. Server executes mutation and returns resources:
   ["todos/user/123", "todo/456"]
   ↓
3. Sidekick receives resource update notification
   ↓
4. Sidekick notifies all clients listening to those resources
   ↓
5. Clients with useListenedQuery('getTodos') automatically refetch
   ↓
6. UI updates with fresh data!
```

### Resource Naming Strategy

This example uses a hierarchical resource naming pattern:

- **Collection resources**: `todos/user/${userId}` - for the list of todos
- **Item resources**: `todo/${id}` - for individual todos

All mutations return **both** collection and item resources to ensure:
- List views update when items are added/removed/changed
- Detail views update when items are modified
- Multiple components stay in sync

## Project Structure

```
src/
├── covenant.ts              # Shared API contract (procedures only)
├── server/
│   ├── server.ts           # Server with InternalSidekick setup
│   ├── auth.ts             # Authentication utilities
│   └── db.ts               # Drizzle database setup
├── client/
│   └── client.ts           # React client with Sidekick connection
└── app/                    # Next.js pages
    ├── page.tsx            # Todo list with useListenedQuery
    ├── login/              # Login page
    └── api/covenant/       # API route handler

tests/
├── unit/
│   ├── procedures.test.ts  # Test all procedures
│   └── resources.test.ts   # Verify resource tracking
├── integration/
│   ├── server.test.ts      # Full CRUD flow tests
│   └── invalidation.test.ts # Test automatic refetch
└── e2e/
    └── todo.spec.ts        # Playwright UI tests

drizzle/
└── schema.ts               # Database schema (users, sessions, todos)
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed

### Installation

```bash
# Install dependencies
bun install

# Initialize database (creates data.db with schema)
# Database is automatically initialized on server startup
```

### Development

```bash
# Start the Next.js development server
bun run dev
```

Visit `http://localhost:3000` and login with:
- Username: `testuser`
- Password: `password`

### Testing

```bash
# Run unit and integration tests
bun test

# Run E2E tests (requires dev server running)
bun run test:e2e
```

## Code Walkthrough

### 1. Covenant Definition (`src/covenant.ts`)

The covenant defines the API contract:

```typescript
export const appCovenant = declareCovenant({
  procedures: {
    login: mutation({ ... }),
    getTodos: query({ ... }),
    createTodo: mutation({ ... }),
    updateTodo: mutation({ ... }),
    deleteTodo: mutation({ ... }),
  },
  channels: {}, // No channels needed for this example
});
```

**Key Point**: Only imports validation schemas (Zod). No implementation code.

### 2. Server with Sidekick (`src/server/server.ts`)

The server sets up InternalSidekick for resource tracking:

```typescript
// Initialize InternalSidekick
export const sidekick = new InternalSidekick();

export const server = new CovenantServer(appCovenant, {
  contextGenerator: async ({ request }) => {
    // Extract user from auth token
    const token = extractTokenFromHeader(request.headers.get('Authorization'));
    const user = await validateToken(token);
    return { user };
  },
  derivation: ({ ctx, error }) => ({
    requireAuth: () => {
      if (!ctx.user) error('Unauthorized', 401);
      return ctx.user;
    },
    db,
  }),
  sidekickConnection: sidekick.getConnectionFromServer(),
});

// CRITICAL: Set the server callback
sidekick.setServerCallback((channelName, params, data, context) =>
  server.processChannelMessage(channelName, params, data, context)
);
```

**Key Point**: The server callback allows Sidekick to forward channel messages to the server.

### 3. Procedure with Resource Tracking

Example of how procedures declare resources:

```typescript
server.defineProcedure('createTodo', {
  // Resources function - declares which resources this procedure touches
  resources: ({ ctx, outputs }) => {
    if (!ctx.user) return [];
    return [
      `todos/user/${ctx.user.id}`,  // Collection resource
      `todo/${outputs.id}`,          // Item resource
    ];
  },
  procedure: async ({ inputs, derived }) => {
    const user = derived.requireAuth();

    // Create the todo
    const newTodo = {
      id: randomBytes(16).toString('hex'),
      userId: user.id,
      title: inputs.title,
      completed: false,
      createdAt: new Date(),
    };

    await derived.db.insert(todos).values(newTodo);
    return newTodo;
  },
});
```

**Key Points**:
- `resources` function has access to `ctx` (context), `inputs`, and `outputs`
- Returns an array of resource identifiers
- Both collection and item resources are declared
- Queries listening to these resources will automatically refetch

### 4. Client with Sidekick (`src/client/client.ts`)

The client connects to Sidekick for resource updates:

```typescript
export const client = new CovenantReactClient(appCovenant, {
  serverConnection: httpClientToServer(
    `${window.location.origin}/api/covenant`,
    {
      headers: () => ({
        Authorization: authToken ? `Bearer ${authToken}` : '',
      }),
    }
  ),
  sidekickConnection: httpClientToSidekick('ws://localhost:3000/ws'),
});
```

**Note**: In this example, we use `httpClientToSidekick` for production-like setup, but for testing we use `sidekick.getConnectionFromClient()` with InternalSidekick.

### 5. UI with useListenedQuery (`src/app/page.tsx`)

The key feature - automatic refetching:

```typescript
export default function TodoPage() {
  // This automatically refetches when mutations occur!
  const todos = client.useListenedQuery('getTodos', null);

  const handleCreateTodo = async (title: string) => {
    await client.mutate('createTodo', { title });
    // No manual refetch needed - useListenedQuery handles it!
  };

  const handleToggleCompleted = async (id: string, completed: boolean) => {
    await client.mutate('updateTodo', { id, completed: !completed });
    // No manual refetch needed!
  };

  const handleDelete = async (id: string) => {
    await client.mutate('deleteTodo', { id });
    // No manual refetch needed!
  };

  // Render loading/error/success states
  if (todos.loading) return <LoadingSpinner />;
  if (todos.error) return <ErrorDisplay />;
  return <TodoList todos={todos.data} />;
}
```

**Key Point**: Zero manual cache management! `useListenedQuery` automatically refetches when related mutations run.

## Testing Strategy

### Unit Tests (`tests/unit/`)

- **procedures.test.ts**: Tests each procedure independently
- **resources.test.ts**: Verifies correct resource identifiers are returned

### Integration Tests (`tests/integration/`)

- **server.test.ts**: Tests full CRUD flow, multi-user isolation
- **invalidation.test.ts**: **Critical tests** that verify automatic refetch behavior

Example invalidation test:

```typescript
test('createTodo mutation triggers getTodos refetch', async () => {
  const results: any[] = [];

  // Listen to getTodos
  const unsubscribe = client.listen('getTodos', null, (result) => {
    if (result.success) results.push(result.data);
  });

  // Wait for initial query
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(results).toHaveLength(1);

  // Create a todo
  await client.mutate('createTodo', { title: 'Test' });

  // Wait for automatic refetch
  await new Promise(resolve => setTimeout(resolve, 50));

  // Verify refetch occurred automatically
  expect(results.length).toBeGreaterThan(1);

  unsubscribe();
});
```

### E2E Tests (`tests/e2e/`)

Playwright tests that verify UI interactions and automatic updates in the browser.

## Key Patterns

### Pattern 1: Resource Naming

Use hierarchical, consistent naming:

```typescript
// Collections
`todos/user/${userId}`
`posts/user/${userId}`

// Items
`todo/${todoId}`
`post/${postId}`

// Related data
`comments/post/${postId}`
```

### Pattern 2: Mutation Resources

Always include both collection and item resources:

```typescript
resources: ({ ctx, outputs, inputs }) => {
  return [
    `todos/user/${ctx.user.id}`,  // So list queries refetch
    `todo/${outputs.id}`,          // So detail queries refetch
  ];
}
```

### Pattern 3: Query Resources

Match the resources from mutations:

```typescript
// This query will automatically refetch when createTodo/updateTodo/deleteTodo run
server.defineProcedure('getTodos', {
  resources: ({ ctx }) => [`todos/user/${ctx.user.id}`],
  procedure: async ({ derived }) => {
    const user = derived.requireAuth();
    return await derived.db.query.todos.findMany({
      where: eq(todos.userId, user.id),
    });
  },
});
```

### Pattern 4: Context and Derivation

- **Context**: Per-request data (auth, user info)
- **Derivation**: Shared utilities (requireAuth, database)

```typescript
contextGenerator: async ({ request }) => {
  // Extract auth data
  const user = await getUserFromRequest(request);
  return { user };
},

derivation: ({ ctx, error }) => ({
  requireAuth: () => {
    if (!ctx.user) error('Unauthorized', 401);
    return ctx.user;
  },
  db: getDatabaseConnection(),
}),
```

## InternalSidekick vs HTTP Sidekick

### InternalSidekick (This Example)

- Co-located with server (same process)
- Perfect for:
  - Development
  - Testing
  - Single-server deployments
  - Serverless/edge that supports long-lived connections

### HTTP Sidekick (Separate Service)

- Separate WebSocket service
- Perfect for:
  - Multi-server deployments
  - Edge deployments that can't run WebSockets
  - Scaling WebSocket connections independently

## Production Considerations

This example uses simplified patterns for clarity. In production:

### Security
- Hash passwords with bcrypt/argon2
- Use secure session tokens (crypto.randomBytes)
- Implement token expiration and rotation
- Add rate limiting
- Validate all inputs
- Use HTTPS

### Database
- Use proper migrations (Drizzle Kit)
- Add indexes for common queries
- Implement connection pooling
- Use transactions for complex operations

### Sidekick
- For edge deployments, use HTTP Sidekick as separate service
- Configure proper WebSocket timeouts
- Implement reconnection logic
- Monitor WebSocket connection health

### Testing
- Expand test coverage
- Add load testing
- Test error scenarios
- Test network failures

## Troubleshooting

### Resources not triggering refetch

- Verify resource names match exactly between queries and mutations
- Check that `sidekick.setServerCallback()` is called
- Ensure `useListenedQuery` is used (not regular `useQuery`)
- For cross-client updates, use `{ remote: true }` option

### Auth issues

- Check that token is being sent in Authorization header
- Verify token hasn't expired
- Ensure contextGenerator is extracting token correctly

### Database issues

- Database is created automatically on first run
- Check that `initializeDatabase()` is called
- Verify test user is created with `createTestUser()`

## Learning Resources

- [Covenant Guide](../guide.md) - Comprehensive guide to Covenant patterns
- [Hello World Example](../covenant-hello-world) - Simpler example without Sidekick
- [Covenant Core Docs](../../packages/covenant/README.md) - Core concepts
- [Sidekick Docs](../../packages/sidekick/README.md) - Sidekick details

## Summary

This example demonstrates Covenant's most powerful feature: **automatic cache invalidation through resource tracking**. By declaring which resources procedures touch, Covenant can automatically refetch queries when data changes, eliminating manual cache management and ensuring your UI always stays in sync with your data.

The key takeaway: **You never have to manually refetch queries**. Just use `useListenedQuery` and Covenant handles the rest!
