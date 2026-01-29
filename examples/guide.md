# Building with Covenant RPC - Guide for Claude Code Agents

This guide provides comprehensive instructions for Claude Code agents building applications with Covenant RPC. It covers architecture, patterns, best practices, and common implementation scenarios.

## Table of Contents

1. [Overview](#overview)
2. [Core Architecture](#core-architecture)
3. [Project Setup](#project-setup)
4. [The Covenant Pattern](#the-covenant-pattern)
5. [Procedures (Queries & Mutations)](#procedures-queries--mutations)
6. [Realtime Channels](#realtime-channels)
7. [Resource Tracking & Cache Invalidation](#resource-tracking--cache-invalidation)
8. [React Patterns](#react-patterns)
9. [Testing Strategies](#testing-strategies)
10. [Error Handling](#error-handling)
11. [Common Implementation Scenarios](#common-implementation-scenarios)
12. [Troubleshooting](#troubleshooting)

---

## Overview

Covenant RPC is a type-safe RPC framework for TypeScript that enforces strict separation between frontend and backend code through a shared "covenant" definition. Key features:

- **Type Safety**: Full end-to-end type inference from server to client
- **Strict Separation**: Frontend and backend communicate only through the covenant
- **Resource Tracking**: Automatic cache invalidation when data changes
- **Realtime Channels**: Bidirectional WebSocket communication
- **Standard Schema**: Works with any validation library (Zod, ArcType, etc.)
- **Edge Compatible**: Optional Sidekick service for edge deployments

**Package Structure:**
- `@covenant/core` - Core types, covenant declarations, interfaces
- `@covenant/server` - Server implementation and adapters
- `@covenant/client` - Client implementation and connections
- `@covenant/react` - React hooks (useQuery, useMutation, useListenedQuery, useCachedQuery)
- `@covenant/sidekick` - Standalone WebSocket service for realtime features
- `@covenant/ion` - Serialization format (superset of JSON with Date, Map, etc.)

---

## Core Architecture

### Three-Layer Pattern

Covenant enforces a strict three-layer architecture:

1. **Covenant Definition** (Shared)
   - Define the contract between frontend and backend
   - Import ONLY validation schemas (Zod, etc.)
   - NO implementation code, NO database imports, NO business logic
   - Placed in an isolated file (e.g., `covenant.ts`)

2. **Server Implementation** (Backend)
   - Create `CovenantServer` with the covenant
   - Implement procedures with `defineProcedure()`
   - Implement channels with `defineChannel()`
   - Handle authentication, database access, business logic

3. **Client Setup** (Frontend)
   - Create `CovenantClient` or `CovenantReactClient` with the covenant
   - Call procedures via `query()` or `mutate()`
   - Connect to channels for realtime features
   - Use React hooks for UI integration

### Connection Layers

Covenant uses abstraction interfaces for different transport layers:

- **`ClientToServerConnection`**: How client calls procedures
  - `httpClientToServer()` - Production (HTTP fetch)
  - `directClientToServer()` - Testing (in-memory)

- **`ClientToSidekickConnection`**: How client does WebSocket
  - `httpClientToSidekick()` - Production (WebSocket)
  - `emptyClientToSidekick()` - When channels aren't needed

- **`ServerToSidekickConnection`**: How server talks to sidekick
  - `httpServerToSidekick()` - Production (HTTP to sidekick service)
  - `InternalSidekick` - Co-located server and sidekick
  - `emptyServerToSidekick()` - When channels aren't needed

---

## Project Setup

### Installation

```bash
# Core packages (required)
bun add @covenant/core @covenant/server @covenant/client @covenant/ion

# React hooks (if using React)
bun add @covenant/react

# Sidekick (if using realtime channels)
bun add @covenant/sidekick

# Validation library (choose one)
bun add zod  # Most common
# OR: bun add arktype
```

### Basic File Structure

```
your-project/
├── src/
│   ├── covenant.ts           # Shared covenant definition
│   ├── server/
│   │   ├── server.ts         # Server setup
│   │   ├── procedures/       # Procedure implementations
│   │   └── channels/         # Channel implementations
│   └── client/
│       └── client.ts         # Client setup
├── package.json
└── tsconfig.json
```

---

## The Covenant Pattern

### Step 1: Define the Covenant (Shared)

Create an isolated file that defines your API contract:

```typescript
// covenant.ts
import { z } from "zod";
import { declareCovenant, query, mutation, channel } from "@covenant/core";

export const appCovenant = declareCovenant({
  procedures: {
    // Query: read-only operations
    getUser: query({
      input: z.object({
        userId: z.string(),
      }),
      output: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
      }),
    }),

    // Mutation: operations that modify data
    updateUser: mutation({
      input: z.object({
        userId: z.string(),
        name: z.string(),
      }),
      output: z.object({
        success: z.boolean(),
      }),
    }),
  },

  channels: {
    // Realtime bidirectional communication
    chat: channel({
      clientMessage: z.object({
        text: z.string(),
      }),
      serverMessage: z.object({
        text: z.string(),
        username: z.string(),
        timestamp: z.number(),
      }),
      connectionRequest: z.object({
        username: z.string(),
      }),
      connectionContext: z.object({
        userId: z.string(),
      }),
      params: ["roomId"],  // URL-like parameters for scoping
    }),
  },
});

// Export type for use in other files
export type AppCovenant = typeof appCovenant;
```

**IMPORTANT RULES:**
- ONLY import validation schemas (Zod, ArcType, etc.)
- NEVER import database code, API clients, or business logic
- NEVER import implementation code from server or client
- Keep this file purely declarative

### Step 2: Implement Server

```typescript
// server/server.ts
import { CovenantServer } from "@covenant/server";
import { emptyServerToSidekick } from "@covenant/server/interfaces/empty";
import { appCovenant } from "../covenant";
import { getUserFromRequest } from "./auth";

// Create server instance
export const server = new CovenantServer(appCovenant, {
  // Context: generated per-request, typically auth data
  contextGenerator: async ({ request, headers }) => {
    const user = await getUserFromRequest(request);
    return { user };
  },

  // Derivation: utility functions available to all procedures
  derivation: ({ ctx, error, logger }) => ({
    requireAuth: () => {
      if (!ctx.user) {
        error("Unauthorized - please log in", 401);
      }
      return ctx.user;
    },
    db: getDatabaseConnection(),
  }),

  // Sidekick connection (use emptyServerToSidekick if not using channels)
  sidekickConnection: emptyServerToSidekick(),
});

// Define procedure implementations
server.defineProcedure("getUser", {
  // Resource function: declare which resources this procedure touches
  resources: ({ inputs, outputs }) => {
    return [`user/${inputs.userId}`];
  },

  // Procedure implementation
  procedure: async ({ inputs, ctx, derived, logger }) => {
    const user = await derived.db.query.users.findFirst({
      where: eq(users.id, inputs.userId),
    });

    if (!user) {
      logger.warn(`User not found: ${inputs.userId}`);
      error("User not found", 404);
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  },
});

server.defineProcedure("updateUser", {
  resources: ({ inputs }) => [`user/${inputs.userId}`],
  procedure: async ({ inputs, derived }) => {
    const user = derived.requireAuth();

    await derived.db.update(users)
      .set({ name: inputs.name })
      .where(eq(users.id, inputs.userId));

    return { success: true };
  },
});

// IMPORTANT: Ensure all procedures are implemented
server.assertAllDefined();

// Handle HTTP requests (for frameworks like Hono, Elysia, etc.)
export const handleRequest = (request: Request) => {
  return server.handle(request);
};
```

### Step 3: Setup Client

```typescript
// client/client.ts
import { CovenantClient } from "@covenant/client";
import { httpClientToServer } from "@covenant/client/interfaces/http";
import { emptyClientToSidekick } from "@covenant/client/interfaces/empty";
import { appCovenant } from "../covenant";

export const client = new CovenantClient(appCovenant, {
  serverConnection: httpClientToServer(
    "http://localhost:3000/api/covenant",  // Your API endpoint
    {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    }
  ),
  sidekickConnection: emptyClientToSidekick(),
});

// Usage
const result = await client.query("getUser", { userId: "123" });
if (result.success) {
  console.log(result.data.name);
} else {
  console.error(result.error.message);
}
```

### Step 4: React Integration

```typescript
// client/client.ts (React version)
import { CovenantReactClient } from "@covenant/react";
import { httpClientToServer } from "@covenant/client/interfaces/http";
import { emptyClientToSidekick } from "@covenant/client/interfaces/empty";
import { appCovenant } from "../covenant";

export const client = new CovenantReactClient(appCovenant, {
  serverConnection: httpClientToServer("http://localhost:3000/api/covenant"),
  sidekickConnection: emptyClientToSidekick(),
});

// Component usage
function UserProfile({ userId }: { userId: string }) {
  const user = client.useQuery("getUser", { userId });

  if (user.loading) return <div>Loading...</div>;
  if (user.error) return <div>Error: {user.error.message}</div>;

  return <div>Hello, {user.data.name}!</div>;
}
```

---

## Procedures (Queries & Mutations)

### Query vs Mutation

- **Query**: Read-only operations, idempotent, cacheable
- **Mutation**: Operations that modify data, trigger cache invalidation

```typescript
// In covenant.ts
procedures: {
  // QUERY: Getting data
  getPosts: query({
    input: z.object({ userId: z.string() }),
    output: z.array(postSchema),
  }),

  // MUTATION: Modifying data
  createPost: mutation({
    input: z.object({ title: z.string(), content: z.string() }),
    output: postSchema,
  }),
}
```

### Implementing Procedures

```typescript
// Full procedure signature
server.defineProcedure("procedureName", {
  resources: ({ inputs, outputs }) => {
    // Return array of resource identifiers
    // These are used for cache invalidation
    return ["posts", `post/${outputs.id}`];
  },

  procedure: async ({ inputs, ctx, derived, logger, error, headers }) => {
    // inputs: validated input data
    // ctx: context from contextGenerator
    // derived: utility functions from derivation
    // logger: logger instance
    // error: function to throw errors
    // headers: HTTP headers from request

    // Your implementation here
    return outputData;
  },
});
```

### Context and Derivation

**Context** (`contextGenerator`): Generated once per request

```typescript
contextGenerator: async ({ request, headers }) => {
  // Extract auth data, session info, etc.
  const token = headers.get("Authorization");
  const user = await validateToken(token);
  return { user, token };
}
```

**Derivation** (`derivation`): Utility functions available to all procedures

```typescript
derivation: ({ ctx, error, logger }) => {
  return {
    // Helper to require authentication
    requireAuth: () => {
      if (!ctx.user) {
        error("Unauthorized", 401);
      }
      return ctx.user;
    },

    // Database connection
    db: getDatabaseConnection(),

    // Any other shared utilities
    sendEmail: (to: string, subject: string, body: string) => {
      // ...
    },
  };
}
```

### Calling Procedures from Client

```typescript
// Query
const result = await client.query("getPosts", { userId: "123" });
if (result.success) {
  console.log(result.data);  // Type-safe!
  console.log(result.resources);  // ["posts", "post/1", "post/2"]
} else {
  console.error(result.error.code, result.error.message);
}

// Mutation
const result = await client.mutate("createPost", {
  title: "Hello",
  content: "World",
});
// Mutations automatically refetch any queries listening to affected resources
```

---

## Realtime Channels

Channels provide bidirectional WebSocket communication with typed messages.

### Defining Channels

```typescript
// In covenant.ts
channels: {
  chat: channel({
    // Message from client to server
    clientMessage: z.object({
      text: z.string(),
    }),

    // Message from server to client
    serverMessage: z.object({
      text: z.string(),
      username: z.string(),
      timestamp: z.number(),
    }),

    // Data sent when client connects
    connectionRequest: z.object({
      username: z.string(),
    }),

    // Context stored per connection
    connectionContext: z.object({
      userId: z.string(),
      username: z.string(),
    }),

    // Parameters for scoping (like URL params)
    params: ["roomId"],
  }),
}
```

### Implementing Channels

```typescript
server.defineChannel("chat", {
  // Called when client connects
  onConnect: async ({ inputs, params, ctx, derived, reject, error }) => {
    // inputs: validated connectionRequest
    // params: { roomId: string } - typed from params array
    // reject: reject connection with client/server/sidekick fault
    // error: throw error during processing

    // Validate connection
    const user = derived.requireAuth();
    if (!canAccessRoom(user, params.roomId)) {
      reject("You don't have access to this room", "client");
    }

    // Return context (stored for this connection)
    return {
      userId: user.id,
      username: inputs.username,
    };
  },

  // Called when client sends a message
  onMessage: async ({ inputs, params, context, derived }) => {
    // inputs: validated clientMessage
    // context: connectionContext from onConnect

    // Process message
    await saveMessageToDatabase({
      roomId: params.roomId,
      userId: context.userId,
      text: inputs.text,
    });

    // Broadcast to all clients in this room
    await server.postChannelMessage("chat", params, {
      text: inputs.text,
      username: context.username,
      timestamp: Date.now(),
    });
  },
});
```

### Using Channels from Client

```typescript
// 1. Connect to channel
const result = await client.connect(
  "chat",
  { roomId: "general" },  // params
  { username: "Alice" }    // connectionRequest
);

if (!result.success) {
  console.error(result.error);
  return;
}

const token = result.token;

// 2. Subscribe to receive messages
const unsubscribe = await client.subscribe(
  "chat",
  { roomId: "general" },
  token,
  (message) => {
    console.log(`${message.username}: ${message.text}`);
  }
);

// 3. Send messages
await client.send(
  "chat",
  { roomId: "general" },
  token,
  { text: "Hello, world!" }
);

// 4. Cleanup
unsubscribe();
```

### Setting up Sidekick

For channels to work, you need to set up Sidekick.

**Option 1: InternalSidekick (co-located)**

```typescript
import { InternalSidekick } from "@covenant/sidekick/internal";

const sidekick = new InternalSidekick();

const server = new CovenantServer(covenant, {
  contextGenerator: () => undefined,
  derivation: () => ({}),
  sidekickConnection: sidekick.getConnectionFromServer(),
});

// IMPORTANT: Set the callback
sidekick.setServerCallback((channelName, params, data, context) =>
  server.processChannelMessage(channelName, params, data, context)
);

const client = new CovenantClient(covenant, {
  serverConnection: directClientToServer(server, {}),
  sidekickConnection: sidekick.getConnectionFromClient(),
});
```

**Option 2: HTTP Sidekick (separate service for edge)**

```typescript
// Server setup
import { httpServerToSidekick } from "@covenant/server/interfaces/http";

const server = new CovenantServer(covenant, {
  sidekickConnection: httpServerToSidekick(
    "http://localhost:3001",  // Sidekick URL
    "your-secret-key"         // Auth key
  ),
  // ...
});

// Client setup
import { httpClientToSidekick } from "@covenant/client/interfaces/http";

const client = new CovenantClient(covenant, {
  sidekickConnection: httpClientToSidekick("ws://localhost:3001/socket"),
  // ...
});
```

---

## Resource Tracking & Cache Invalidation

Resource tracking enables automatic cache invalidation when data changes.

### How It Works

1. **Procedures declare resources** they touch via the `resources` function
2. **Queries can listen** to resources and auto-refetch when they change
3. **Mutations trigger refetch** for all queries listening to affected resources
4. **Local vs Remote**: Local (same client) vs Remote (cross-client via Sidekick)

### Example

```typescript
// Server: Define resources
server.defineProcedure("getTodos", {
  resources: ({ inputs }) => ["todos", `todos/user/${inputs.userId}`],
  procedure: async ({ inputs }) => {
    return await db.getTodos(inputs.userId);
  },
});

server.defineProcedure("createTodo", {
  resources: ({ inputs, outputs }) => [
    "todos",
    `todos/user/${inputs.userId}`,
    `todo/${outputs.id}`,
  ],
  procedure: async ({ inputs }) => {
    return await db.createTodo(inputs);
  },
});

// Client: Listen to query (auto-refetch on mutation)
const unsubscribe = client.listen(
  "getTodos",
  { userId: "123" },
  (result) => {
    console.log("Todos updated:", result.data);
  },
  { remote: true }  // Listen for remote updates via Sidekick
);

// When this mutation runs, getTodos will automatically refetch
await client.mutate("createTodo", {
  userId: "123",
  title: "New todo",
});
```

### Resource Naming Best Practices

- Use hierarchical naming: `"user/123"`, `"user/123/posts"`, `"post/456"`
- Include IDs when specific: `"post/${id}"` not just `"posts"`
- Use broad names for collections: `"posts"`, `"users"`
- Be consistent across procedures

---

## React Patterns

### useQuery

Basic query hook with loading/error states:

```typescript
function UserProfile({ userId }: { userId: string }) {
  const user = client.useQuery("getUser", { userId });

  if (user.loading) return <LoadingSpinner />;
  if (user.error) return <ErrorDisplay error={user.error} />;

  return <div>Welcome, {user.data.name}!</div>;
}
```

### useMutation

Execute mutations from UI:

```typescript
function CreatePostButton() {
  const [title, setTitle] = useState("");
  const result = client.useMutation("createPost", { title, content: "" });

  const handleClick = async () => {
    // Note: useMutation executes on every render with current inputs
    // For form submissions, use client.mutate() directly instead
  };

  // Better approach:
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const result = await client.mutate("createPost", { title, content: "" });
    if (result.success) {
      setTitle("");
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### useListenedQuery

Auto-refetching query that responds to mutations:

```typescript
function TodoList({ userId }: { userId: string }) {
  // Automatically refetches when "todos" or related resources change
  const todos = client.useListenedQuery("getTodos", { userId });

  if (todos.loading) return <LoadingSpinner />;
  if (todos.error) return <ErrorDisplay error={todos.error} />;

  return (
    <ul>
      {todos.data.map(todo => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
}

function AddTodoButton({ userId }: { userId: string }) {
  const handleAdd = async () => {
    // This mutation will trigger TodoList to refetch automatically
    await client.mutate("createTodo", { userId, title: "New todo" });
  };

  return <button onClick={handleAdd}>Add Todo</button>;
}
```

### useCachedQuery

Shared cache across all components using the same query:

```typescript
// Multiple components using the same query share state
function Header() {
  const user = client.useCachedQuery("getCurrentUser", null);
  if (user.loading) return <Skeleton />;
  return <div>Logged in as {user.data.name}</div>;
}

function Sidebar() {
  const user = client.useCachedQuery("getCurrentUser", null);
  if (user.loading) return <Skeleton />;
  return <UserAvatar user={user.data} />;
}

// Both components share the same query result and loading state
```

### Discriminated Unions Pattern

All hooks return discriminated unions - use type narrowing:

```typescript
const result = client.useQuery("getUser", { userId });

// Type narrowing with if statements
if (result.loading) {
  // result.data is null, result.error is null
  return <LoadingSpinner />;
}

if (result.error) {
  // result.data is null, result.error is defined
  return <ErrorDisplay error={result.error} />;
}

// At this point, TypeScript knows result.data is defined
return <UserDisplay user={result.data} />;
```

### Component Patterns (from SKELETON_UI_PATTERNS.md)

**DON'T repeat UI structures:**

```typescript
// BAD - repeating structure
function TodoList() {
  const todos = client.useListenedQuery("getTodos", null);

  if (todos.loading) {
    return (
      <div className="container">
        <div className="header">Loading...</div>
      </div>
    );
  }

  if (todos.error) {
    return (
      <div className="container">
        <div className="header">Error</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">Todos</div>
      {todos.data.map(...)}
    </div>
  );
}
```

**DO extract common components:**

```typescript
// GOOD - single structure with conditional content
function TodoList() {
  const todos = client.useListenedQuery("getTodos", null);

  return (
    <Container>
      <Header
        isLoading={todos.loading}
        isError={todos.error !== null}
      />
      {!todos.loading && !todos.error && (
        <TodoItems items={todos.data} />
      )}
    </Container>
  );
}

function Header({ isLoading, isError }: { isLoading: boolean, isError: boolean }) {
  if (isLoading) return <div className="header">Loading...</div>;
  if (isError) return <div className="header">Error</div>;
  return <div className="header">Todos</div>;
}
```

---

## Testing Strategies

### Unit Testing Procedures

Use `directClientToServer` to bypass HTTP:

```typescript
import { test, expect } from "bun:test";
import { declareCovenant, query } from "@covenant/core";
import { CovenantServer } from "@covenant/server";
import { CovenantClient } from "@covenant/client";
import { emptyServerToSidekick } from "@covenant/server/interfaces/empty";
import { emptyClientToSidekick } from "@covenant/client/interfaces/empty";
import { directClientToServer } from "@covenant/server/interfaces/direct";
import { z } from "zod";

test("getUser procedure", async () => {
  const covenant = declareCovenant({
    procedures: {
      getUser: query({
        input: z.object({ userId: z.string() }),
        output: z.object({ name: z.string() }),
      }),
    },
    channels: {},
  });

  const server = new CovenantServer(covenant, {
    contextGenerator: () => undefined,
    derivation: () => ({}),
    sidekickConnection: emptyServerToSidekick(),
  });

  server.defineProcedure("getUser", {
    resources: ({ inputs }) => [`user/${inputs.userId}`],
    procedure: ({ inputs }) => {
      return { name: `User ${inputs.userId}` };
    },
  });

  const client = new CovenantClient(covenant, {
    serverConnection: directClientToServer(server, {}),
    sidekickConnection: emptyClientToSidekick(),
  });

  const result = await client.query("getUser", { userId: "123" });

  expect(result.success).toBe(true);
  expect(result.data.name).toBe("User 123");
  expect(result.resources).toEqual(["user/123"]);
});
```

### Testing Resource Invalidation

```typescript
test("mutation triggers query refetch", async () => {
  // ... setup covenant, server, client ...

  const results: any[] = [];

  const unsubscribe = client.listen("getTodos", null, (result) => {
    results.push(result.data);
  });

  // Wait for initial query
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(results).toHaveLength(1);
  expect(results[0]).toEqual([]);

  // Mutate
  await client.mutate("createTodo", { title: "Test" });

  // Wait for refetch
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(results).toHaveLength(2);
  expect(results[1]).toHaveLength(1);

  unsubscribe();
});
```

### Testing Channels

Use `InternalSidekick` for testing:

```typescript
import { InternalSidekick } from "@covenant/sidekick/internal";

test("channel bidirectional communication", async () => {
  const sidekick = new InternalSidekick();

  const covenant = declareCovenant({
    procedures: {},
    channels: {
      chat: channel({
        clientMessage: z.object({ text: z.string() }),
        serverMessage: z.object({ text: z.string() }),
        connectionRequest: z.null(),
        connectionContext: z.null(),
        params: [],
      }),
    },
  });

  const server = new CovenantServer(covenant, {
    contextGenerator: () => undefined,
    derivation: () => ({}),
    sidekickConnection: sidekick.getConnectionFromServer(),
  });

  sidekick.setServerCallback((channelName, params, data, context) =>
    server.processChannelMessage(channelName, params, data, context)
  );

  server.defineChannel("chat", {
    onConnect: () => null,
    onMessage: async ({ inputs }) => {
      // Echo back
      await server.postChannelMessage("chat", {}, { text: inputs.text });
    },
  });

  const client = new CovenantClient(covenant, {
    serverConnection: directClientToServer(server, {}),
    sidekickConnection: sidekick.getConnectionFromClient(),
  });

  const connectResult = await client.connect("chat", {}, null);
  expect(connectResult.success).toBe(true);

  const messages: string[] = [];
  await client.subscribe("chat", {}, connectResult.token, (msg) => {
    messages.push(msg.text);
  });

  await client.send("chat", {}, connectResult.token, { text: "Hello!" });
  await new Promise(resolve => setTimeout(resolve, 50));

  expect(messages).toEqual(["Hello!"]);
});
```

### Testing Best Practices

1. **Use direct connections** for faster tests (no HTTP overhead)
2. **Use empty connections** when not testing channels/sidekick
3. **Always call `server.assertAllDefined()`** to catch missing implementations
4. **Test both success and error paths**
5. **Use timeouts** when testing async operations (listen, channels)
6. **Clean up subscriptions** with unsubscribe functions
7. **Mock external dependencies** (database, APIs) in derivation

---

## Error Handling

### Server-Side Errors

```typescript
server.defineProcedure("getUser", {
  resources: ({ inputs }) => [`user/${inputs.userId}`],
  procedure: async ({ inputs, error, logger }) => {
    const user = await db.getUser(inputs.userId);

    if (!user) {
      // Method 1: Call error function (recommended)
      error("User not found", 404);
      // This throws ThrowableProcedureError internally
    }

    // Method 2: Throw directly (less common)
    // throw new ThrowableProcedureError("User not found", 404);

    return user;
  },
});
```

### Channel Errors

```typescript
server.defineChannel("chat", {
  onConnect: ({ inputs, reject, error }) => {
    // Reject connection (client sees it as failed connection)
    if (!inputs.password) {
      reject("Password required", "client");
      // fault options: "client", "server", "sidekick"
    }

    // Error during processing (connection attempt fails)
    if (systemDown) {
      error("System temporarily unavailable", "server");
    }

    return { userId: "123" };
  },

  onMessage: ({ inputs, error }) => {
    if (inputs.text.includes("spam")) {
      error("Message rejected: spam detected", "client");
    }
  },
});
```

### Client-Side Error Handling

```typescript
// Procedures
const result = await client.query("getUser", { userId: "123" });

if (!result.success) {
  console.error(result.error.code);     // 404
  console.error(result.error.message);  // "User not found"
  // result.data is null
  // result.resources is null
} else {
  console.log(result.data);  // User data
  // result.error is null
}

// Channels
const connectResult = await client.connect("chat", {}, { username: "Alice" });

if (!connectResult.success) {
  console.error(connectResult.error.message);
  console.error(connectResult.error.fault);  // "client" | "server" | "sidekick"
} else {
  const token = connectResult.token;
  // Proceed with channel operations
}
```

### React Error Handling

```typescript
function UserProfile({ userId }: { userId: string }) {
  const user = client.useQuery("getUser", { userId });

  if (user.loading) {
    return <LoadingSpinner />;
  }

  if (user.error) {
    // user.error has { code: number, message: string }
    if (user.error.code === 404) {
      return <NotFound />;
    }
    if (user.error.code === 401) {
      return <RequireLogin />;
    }
    return <ErrorDisplay error={user.error} />;
  }

  return <UserDisplay user={user.data} />;
}
```

---

## Common Implementation Scenarios

### Scenario 1: CRUD Application

```typescript
// covenant.ts
export const crud = declareCovenant({
  procedures: {
    // Read
    listItems: query({
      input: z.null(),
      output: z.array(itemSchema),
    }),
    getItem: query({
      input: z.object({ id: z.string() }),
      output: itemSchema,
    }),

    // Create
    createItem: mutation({
      input: z.object({ name: z.string() }),
      output: itemSchema,
    }),

    // Update
    updateItem: mutation({
      input: z.object({ id: z.string(), name: z.string() }),
      output: itemSchema,
    }),

    // Delete
    deleteItem: mutation({
      input: z.object({ id: z.string() }),
      output: z.object({ success: z.boolean() }),
    }),
  },
  channels: {},
});

// server.ts - Resource strategy for CRUD
server.defineProcedure("listItems", {
  resources: () => ["items"],  // Collection
  procedure: async () => db.getAllItems(),
});

server.defineProcedure("getItem", {
  resources: ({ inputs }) => [`item/${inputs.id}`],  // Specific item
  procedure: async ({ inputs }) => db.getItem(inputs.id),
});

server.defineProcedure("createItem", {
  resources: ({ outputs }) => ["items", `item/${outputs.id}`],
  procedure: async ({ inputs }) => db.createItem(inputs),
});

server.defineProcedure("updateItem", {
  resources: ({ inputs }) => ["items", `item/${inputs.id}`],
  procedure: async ({ inputs }) => db.updateItem(inputs),
});

server.defineProcedure("deleteItem", {
  resources: ({ inputs }) => ["items", `item/${inputs.id}`],
  procedure: async ({ inputs }) => {
    await db.deleteItem(inputs.id);
    return { success: true };
  },
});
```

### Scenario 2: Authentication

```typescript
// covenant.ts
procedures: {
  login: mutation({
    input: z.object({
      username: z.string(),
      password: z.string(),
    }),
    output: z.object({
      token: z.string(),
      userId: z.string(),
    }),
  }),

  getCurrentUser: query({
    input: z.null(),
    output: userSchema,
  }),
}

// server.ts
server.defineProcedure("login", {
  resources: () => [],  // No resources for login
  procedure: async ({ inputs }) => {
    const user = await validateCredentials(inputs.username, inputs.password);
    if (!user) {
      error("Invalid credentials", 401);
    }

    const token = await createAuthToken(user.id);
    return { token, userId: user.id };
  },
});

server.defineProcedure("getCurrentUser", {
  resources: ({ ctx }) => [`user/${ctx.user.id}`],
  procedure: async ({ derived }) => {
    const user = derived.requireAuth();
    return await db.getUser(user.id);
  },
});

// client.ts - Store and send auth token
let authToken = localStorage.getItem("authToken");

export const client = new CovenantClient(covenant, {
  serverConnection: httpClientToServer(
    "http://localhost:3000/api/covenant",
    {
      headers: {
        Authorization: authToken ? `Bearer ${authToken}` : "",
      },
    }
  ),
  sidekickConnection: emptyClientToSidekick(),
});

// Login flow
async function login(username: string, password: string) {
  const result = await client.mutate("login", { username, password });
  if (result.success) {
    authToken = result.data.token;
    localStorage.setItem("authToken", authToken);
    // Reinitialize client with new token
  }
}
```

### Scenario 3: Realtime Chat

```typescript
// covenant.ts
channels: {
  chat: channel({
    clientMessage: z.object({
      text: z.string(),
    }),
    serverMessage: z.object({
      id: z.string(),
      text: z.string(),
      username: z.string(),
      timestamp: z.number(),
    }),
    connectionRequest: z.object({
      username: z.string(),
    }),
    connectionContext: z.object({
      userId: z.string(),
      username: z.string(),
    }),
    params: ["roomId"],
  }),
}

// server.ts
server.defineChannel("chat", {
  onConnect: async ({ inputs, params, derived }) => {
    const user = derived.requireAuth();

    // Announce user joined
    await server.postChannelMessage("chat", params, {
      id: randomUUID(),
      text: `${inputs.username} joined the room`,
      username: "System",
      timestamp: Date.now(),
    });

    return {
      userId: user.id,
      username: inputs.username,
    };
  },

  onMessage: async ({ inputs, params, context }) => {
    const messageId = randomUUID();

    // Save to database
    await db.saveMessage({
      id: messageId,
      roomId: params.roomId,
      userId: context.userId,
      text: inputs.text,
      timestamp: Date.now(),
    });

    // Broadcast to all clients
    await server.postChannelMessage("chat", params, {
      id: messageId,
      text: inputs.text,
      username: context.username,
      timestamp: Date.now(),
    });
  },
});

// React component
function ChatRoom({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    // Connect to channel
    client.connect("chat", { roomId }, { username: "Alice" })
      .then(result => {
        if (result.success) {
          setToken(result.token);

          // Subscribe to messages
          client.subscribe("chat", { roomId }, result.token, (message) => {
            setMessages(prev => [...prev, message]);
          });
        }
      });
  }, [roomId]);

  const handleSend = async () => {
    if (!token || !input) return;

    await client.send("chat", { roomId }, token, { text: input });
    setInput("");
  };

  return (
    <div>
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id}>
            <strong>{msg.username}:</strong> {msg.text}
          </div>
        ))}
      </div>
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={handleSend}>Send</button>
    </div>
  );
}
```

### Scenario 4: File Upload

```typescript
// Note: Covenant procedures use JSON-serializable data
// For file uploads, use a separate endpoint or base64 encode

// Option 1: Separate endpoint
// Upload file to /upload endpoint, get URL, then use URL in covenant procedure

// Option 2: Base64 (for small files)
procedures: {
  uploadAvatar: mutation({
    input: z.object({
      fileName: z.string(),
      contentType: z.string(),
      base64Data: z.string(),
    }),
    output: z.object({
      url: z.string(),
    }),
  }),
}

server.defineProcedure("uploadAvatar", {
  resources: ({ ctx }) => [`user/${ctx.user.id}`],
  procedure: async ({ inputs, derived }) => {
    const user = derived.requireAuth();

    // Decode base64
    const buffer = Buffer.from(inputs.base64Data, "base64");

    // Upload to storage (S3, etc.)
    const url = await uploadToStorage(buffer, inputs.fileName, inputs.contentType);

    // Update user record
    await db.updateUser(user.id, { avatarUrl: url });

    return { url };
  },
});
```

---

## Troubleshooting

### Common Issues

**1. "Procedure not defined" error**

```typescript
// Make sure you call assertAllDefined()
server.defineProcedure("myProcedure", { ... });
server.assertAllDefined();  // ← Add this!
```

**2. Type mismatch between covenant and implementation**

```typescript
// Covenant says output is string
output: z.string()

// But implementation returns number
procedure: () => {
  return 123;  // ← TypeScript error!
}

// Fix: Match the types
procedure: () => {
  return "123";
}
```

**3. Resources not triggering refetch**

```typescript
// Make sure resource names match exactly
server.defineProcedure("getTodos", {
  resources: () => ["todos"],  // ← Must match
  procedure: () => db.getTodos(),
});

server.defineProcedure("createTodo", {
  resources: () => ["todos"],  // ← Must match
  procedure: () => db.createTodo(),
});

// And enable remote listening if needed
client.listen("getTodos", null, callback, { remote: true });
```

**4. Channels not receiving messages**

```typescript
// Don't forget to set the server callback for InternalSidekick
const sidekick = new InternalSidekick();
sidekick.setServerCallback((channelName, params, data, context) =>
  server.processChannelMessage(channelName, params, data, context)
);  // ← Don't forget this!
```

**5. Validation errors**

```typescript
// Check that input/output data matches schemas exactly
// Common issue: optional fields
input: z.object({
  name: z.string(),
  age: z.number().optional(),  // ← Optional field
})

// Client can omit age
await client.query("procedure", { name: "Alice" });  // OK
await client.query("procedure", { name: "Alice", age: 30 });  // Also OK
```

**6. Context undefined**

```typescript
// Make sure contextGenerator returns the right type
contextGenerator: async () => {
  return { user: await getUser() };  // ← Return object, not undefined
}

// Then access in procedures
procedure: ({ ctx }) => {
  console.log(ctx.user);  // Works!
}
```

### Debugging Tips

1. **Enable logging**: Use the `logLevel` option in `CovenantServer`
2. **Check network tab**: Verify HTTP requests are being made
3. **Use logger in procedures**: The `logger` parameter is useful for debugging
4. **Test with directClientToServer**: Isolate server logic from HTTP issues
5. **Check resource names**: `console.log(result.resources)` to see what's returned
6. **Verify sidekick connection**: Check WebSocket connection in browser dev tools

---

## Best Practices Summary

### Covenant Definition
- ✅ ONLY import validation schemas
- ✅ Keep it purely declarative
- ❌ NEVER import implementation code
- ❌ NEVER import database or business logic

### Server Implementation
- ✅ Use `contextGenerator` for per-request auth data
- ✅ Use `derivation` for shared utilities
- ✅ Always call `server.assertAllDefined()`
- ✅ Return specific resource identifiers
- ✅ Use `error()` function for throwing errors
- ❌ Don't return broad resource names like `["data"]`

### Client Usage
- ✅ Check `result.success` before accessing `result.data`
- ✅ Use discriminated union pattern in React
- ✅ Clean up subscriptions with `unsubscribe()`
- ✅ Use `useListenedQuery` for auto-updating data
- ❌ Don't assume `result.data` exists without checking

### Testing
- ✅ Use `directClientToServer` for unit tests
- ✅ Use `emptyServerToSidekick` when not testing channels
- ✅ Use `InternalSidekick` for channel tests
- ✅ Test both success and error paths
- ✅ Clean up subscriptions in tests

### Resource Tracking
- ✅ Use hierarchical names: `"user/123"`, `"post/456"`
- ✅ Include both collection and item resources in mutations
- ✅ Be consistent across procedures
- ❌ Don't use vague names like `["data"]` or `["cache"]`

### Channels
- ✅ Validate connections in `onConnect`
- ✅ Use `reject()` for invalid connections
- ✅ Use `params` for scoping (like URL params)
- ✅ Store per-connection context
- ✅ Set server callback for `InternalSidekick`

---

## Quick Reference

### Package Imports

```typescript
// Core
import { declareCovenant, query, mutation, channel } from "@covenant/core";

// Server
import { CovenantServer } from "@covenant/server";
import { emptyServerToSidekick } from "@covenant/server/interfaces/empty";
import { httpServerToSidekick } from "@covenant/server/interfaces/http";
import { directClientToServer } from "@covenant/server/interfaces/direct";

// Client
import { CovenantClient } from "@covenant/client";
import { emptyClientToSidekick } from "@covenant/client/interfaces/empty";
import { httpClientToServer } from "@covenant/client/interfaces/http";
import { httpClientToSidekick } from "@covenant/client/interfaces/http";

// React
import { CovenantReactClient } from "@covenant/react";

// Sidekick
import { InternalSidekick } from "@covenant/sidekick/internal";

// Testing
import { test, expect } from "bun:test";
```

### Type Inference Helpers

```typescript
import type { InferProcedureInputs, InferProcedureOutputs } from "@covenant/core/procedure";
import type { InferChannelParams, InferChannelConnectionRequest, InferChannelConnectionContext, InferChannelClientMessage, InferChannelServerMessage } from "@covenant/core/channel";

// Usage
type GetUserInput = InferProcedureInputs<typeof covenant.procedures.getUser>;
type GetUserOutput = InferProcedureOutputs<typeof covenant.procedures.getUser>;
```

### Procedure Signature

```typescript
server.defineProcedure("name", {
  resources: ({ inputs, outputs }) => string[],
  procedure: async ({ inputs, ctx, derived, logger, error, headers }) => {
    // Implementation
    return outputData;
  },
});
```

### Channel Signature

```typescript
server.defineChannel("name", {
  onConnect: async ({ inputs, params, ctx, derived, reject, error }) => {
    return connectionContext;
  },
  onMessage: async ({ inputs, params, context, derived, error }) => {
    // Handle message
  },
});
```

---

This guide covers the essential patterns for building with Covenant RPC. For more details, refer to the test files in the codebase and the official documentation.
