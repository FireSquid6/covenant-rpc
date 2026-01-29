# Covenant Hello World

A minimal Next.js application demonstrating basic Covenant RPC usage with authentication.

## Overview

This example shows the fundamental patterns of building with Covenant RPC:

- **Type-safe RPC**: Define procedures once, use them everywhere with full type safety
- **Authentication**: Simple username/password auth with context-based authorization
- **React Integration**: Use React hooks for seamless data fetching
- **Comprehensive Testing**: Unit, integration, and end-to-end tests

## Features

- Login with username/password
- Personalized greeting for authenticated users
- Automatic auth checking and redirects
- Error handling and loading states
- Full test coverage

## Tech Stack

- **Runtime**: Bun
- **Framework**: Next.js 14 (App Router)
- **UI**: React 18
- **Database**: SQLite with Drizzle ORM
- **RPC**: Covenant (@covenant/core, @covenant/server, @covenant/client, @covenant/react)
- **Testing**: Bun test + Playwright

## Project Structure

```
covenant-hello-world/
├── src/
│   ├── covenant.ts              # Shared covenant definition
│   ├── server/
│   │   ├── server.ts            # CovenantServer setup
│   │   ├── auth.ts              # Auth utilities
│   │   └── db.ts                # Database connection
│   ├── client/
│   │   └── client.ts            # CovenantReactClient setup
│   └── app/                     # Next.js app directory
│       ├── layout.tsx           # Root layout
│       ├── page.tsx             # Home page
│       ├── login/
│       │   └── page.tsx         # Login page
│       └── api/
│           └── covenant/
│               └── route.ts     # API route handler
├── tests/
│   ├── unit/
│   │   └── procedures.test.ts  # Unit tests
│   ├── integration/
│   │   └── server.test.ts      # Integration tests
│   └── e2e/
│       └── hello.spec.ts       # Playwright e2e tests
└── drizzle/
    └── schema.ts               # Database schema
```

## Getting Started

### 1. Install Dependencies

```bash
bun install
```

### 2. Run the Development Server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Login

Use the test credentials:
- **Username**: `testuser`
- **Password**: `password123`

A test user is automatically created when the server starts.

## Running Tests

### Unit Tests

Fast, isolated tests for individual procedures:

```bash
bun test tests/unit
```

### Integration Tests

Tests for the full server with database:

```bash
bun test tests/integration
```

### All Bun Tests

```bash
bun test
```

### End-to-End Tests

Tests for complete user flows with Playwright:

```bash
# Install Playwright browsers (first time only)
bunx playwright install

# Run e2e tests
bun run test:e2e
```

## Architecture

### The Covenant Pattern

Covenant enforces strict separation between frontend and backend:

1. **Covenant Definition** (`src/covenant.ts`)
   - Defines the API contract
   - Only imports validation schemas (Zod)
   - No implementation code

2. **Server Implementation** (`src/server/server.ts`)
   - Implements procedures with `defineProcedure()`
   - Handles authentication via context
   - Uses derivation for shared utilities

3. **Client Setup** (`src/client/client.ts`)
   - Creates `CovenantReactClient` instance
   - Configures HTTP connection to server
   - Manages auth token

### Authentication Flow

1. User submits login form
2. `login` mutation validates credentials
3. Server creates session and returns token
4. Client stores token in localStorage
5. Token is sent in `Authorization` header for subsequent requests
6. Server validates token in `contextGenerator`
7. Procedures use `requireAuth()` from derivation to enforce authentication

### Context and Derivation

- **Context**: Generated per-request, contains authenticated user info (or null)
- **Derivation**: Utility functions available to all procedures:
  - `requireAuth()`: Throws 401 error if not authenticated
  - `db`: Database access

### Resource Tracking

Procedures declare which resources they touch:
- `login`: `[]` (no cacheable resources)
- `getHello`: `["user/${userId}"]` (user-specific resource)

This enables automatic cache invalidation when data changes.

## Key Covenant Patterns Demonstrated

### 1. Procedure Definition

```typescript
// In covenant.ts - just the contract
login: mutation({
  input: z.object({
    username: z.string(),
    password: z.string(),
  }),
  output: z.object({
    token: z.string(),
    userId: z.string(),
    username: z.string(),
  }),
})
```

### 2. Procedure Implementation

```typescript
// In server.ts - the implementation
server.defineProcedure('login', {
  resources: () => [],
  procedure: async ({ inputs, error }) => {
    const user = await validateCredentials(inputs.username, inputs.password);
    if (!user) {
      error('Invalid username or password', 401);
    }
    const token = await createSession(user.id);
    return { token, userId: user.id, username: user.username };
  },
});
```

### 3. React Hook Usage

```typescript
// In React components
const hello = client.useQuery('getHello', null);

if (hello.loading) return <div>Loading...</div>;
if (hello.error) return <div>Error: {hello.error.message}</div>;
return <div>{hello.data.message}</div>;
```

### 4. Context-Based Authorization

```typescript
// In derivation
requireAuth: () => {
  if (!ctx.user) {
    error('Unauthorized - please log in', 401);
  }
  return ctx.user;
}

// In procedure
procedure: ({ derived }) => {
  const user = derived.requireAuth();
  // Now we know user is authenticated
}
```

## Common Operations

### Adding a New Procedure

1. **Define in covenant** (`src/covenant.ts`):
   ```typescript
   getTodos: query({
     input: z.null(),
     output: z.array(todoSchema),
   })
   ```

2. **Implement in server** (`src/server/server.ts`):
   ```typescript
   server.defineProcedure('getTodos', {
     resources: ({ derived }) => {
       const user = derived.requireAuth();
       return [`todos/user/${user.id}`];
     },
     procedure: async ({ derived }) => {
       const user = derived.requireAuth();
       return await derived.db.query.todos.findMany({
         where: eq(todos.userId, user.id),
       });
     },
   });
   ```

3. **Use in client**:
   ```typescript
   const todos = client.useQuery('getTodos', null);
   ```

### Adding a Mutation

Similar to query, but use `mutation()` in covenant and trigger cache invalidation:

```typescript
createTodo: mutation({
  input: z.object({ title: z.string() }),
  output: todoSchema,
})

server.defineProcedure('createTodo', {
  resources: ({ derived, outputs }) => {
    const user = derived.requireAuth();
    return [`todos/user/${user.id}`, `todo/${outputs.id}`];
  },
  procedure: async ({ inputs, derived }) => {
    const user = derived.requireAuth();
    // Create todo...
    return newTodo;
  },
});
```

## Database

The example uses SQLite with Drizzle ORM for simplicity. The schema includes:

- **users**: id, username, password, created_at
- **sessions**: id, user_id, token, created_at, expires_at

**Note**: This is a demo - in production, you should:
- Hash passwords with bcrypt/argon2
- Implement proper session management
- Add rate limiting
- Use HTTPS
- Validate input more thoroughly

## Testing Strategy

### Unit Tests
- Test procedures in isolation
- Use `directClientToServer` for fast in-memory testing
- Mock database with in-memory SQLite

### Integration Tests
- Test the actual server implementation
- Use real database and auth logic
- Verify end-to-end request/response flow

### E2E Tests
- Test complete user flows in a real browser
- Verify UI interactions and navigation
- Test error states and edge cases

## Learn More

- [Covenant RPC Guide](../guide.md) - Comprehensive patterns and APIs
- [Covenant Documentation](../../README.md) - Framework overview
- [Next.js Documentation](https://nextjs.org/docs)
- [Drizzle ORM](https://orm.drizzle.team/)

## License

This example is part of the Covenant RPC project.
