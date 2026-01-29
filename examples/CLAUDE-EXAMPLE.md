# Building with Covenant RPC - Template for Claude Agents

This document provides a battle-tested template for Claude agents building applications with Covenant RPC. It's based on implementing three complete examples: hello-world, todo, and chat applications.

## Table of Contents
- [Quick Reference](#quick-reference)
- [Project Setup](#project-setup)
- [The Three-Layer Pattern](#the-three-layer-pattern)
- [Authentication Pattern](#authentication-pattern)
- [CRUD Pattern](#crud-pattern)
- [Realtime Channels Pattern](#realtime-channels-pattern)
- [Testing Strategy](#testing-strategy)
- [Common Pitfalls](#common-pitfalls)
- [Known Issues](#known-issues)

---

## Quick Reference

### Essential Imports
```typescript
// Covenant definition (shared)
import { declareCovenant, query, mutation, channel } from '@covenant/core';
import { z } from 'zod';

// Server
import { CovenantServer } from '@covenant/server';
import { emptyServerToSidekick } from '@covenant/server/interfaces/empty';
import { InternalSidekick } from '@covenant/sidekick/internal';

// Client
import { CovenantClient } from '@covenant/client';
import { CovenantReactClient } from '@covenant/react';
import { httpClientToServer } from '@covenant/client/interfaces/http';
import { emptyClientToSidekick } from '@covenant/client/interfaces/empty';

// Testing
import { directClientToServer } from '@covenant/server/interfaces/direct';
import { test, expect } from 'bun:test';
```

### When to Use What
- **emptyServerToSidekick / emptyClientToSidekick**: When NOT using realtime channels
- **InternalSidekick**: When using resource tracking (listenedQuery) or realtime channels
- **httpClientToServer**: Production client (HTTP fetch)
- **directClientToServer**: Testing (in-memory, no HTTP overhead)

---

## Project Setup

### 1. Directory Structure
```
your-app/
├── src/
│   ├── covenant.ts              # ⚠️ Shared covenant definition
│   ├── server/
│   │   ├── server.ts            # Server implementation
│   │   ├── auth.ts              # Auth utilities
│   │   └── db.ts                # Database setup
│   ├── client/
│   │   └── client.ts            # Client setup
│   └── app/                     # Next.js app directory
│       ├── page.tsx
│       └── api/covenant/route.ts
├── drizzle/
│   └── schema.ts                # Database schema
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── package.json
└── tsconfig.json
```

### 2. Dependencies
```json
{
  "dependencies": {
    "@covenant/core": "workspace:*",
    "@covenant/server": "workspace:*",
    "@covenant/client": "workspace:*",
    "@covenant/react": "workspace:*",
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
    "drizzle-kit": "latest",
    "@playwright/test": "^1.40.0"
  }
}
```

### 3. Database Setup (Drizzle + SQLite)
```typescript
// drizzle/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
});

// src/server/db.ts
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from '../../drizzle/schema';

const sqlite = new Database('app.db');
export const db = drizzle(sqlite, { schema });
```

---

## The Three-Layer Pattern

Covenant enforces strict separation between frontend and backend. Follow this pattern religiously.

### Layer 1: Covenant Definition (PURE - NO IMPLEMENTATION)

```typescript
// src/covenant.ts
import { z } from 'zod';
import { declareCovenant, query, mutation } from '@covenant/core';

// ⚠️ ONLY import validation schemas
// ❌ NEVER import database code, API clients, or business logic

export const appCovenant = declareCovenant({
  procedures: {
    // Query: read-only, idempotent
    getUser: query({
      input: z.object({ userId: z.string() }),
      output: z.object({
        id: z.string(),
        username: z.string(),
      }),
    }),

    // Mutation: modifies data, triggers cache invalidation
    createUser: mutation({
      input: z.object({ username: z.string(), password: z.string() }),
      output: z.object({ id: z.string() }),
    }),
  },
  channels: {},
});

export type AppCovenant = typeof appCovenant;
```

### Layer 2: Server Implementation

```typescript
// src/server/server.ts
import { CovenantServer } from '@covenant/server';
import { emptyServerToSidekick } from '@covenant/server/interfaces/empty';
import { appCovenant } from '../covenant';
import { getUserFromToken } from './auth';
import { db } from './db';

export const server = new CovenantServer(appCovenant, {
  // Context: generated per-request
  contextGenerator: async ({ request }) => {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const user = token ? await getUserFromToken(token) : null;
    return { user };
  },

  // Derivation: utility functions available to all procedures
  derivation: ({ ctx, error }) => ({
    requireAuth: () => {
      if (!ctx.user) {
        error('Unauthorized - please log in', 401);
      }
      return ctx.user;
    },
    db,
  }),

  sidekickConnection: emptyServerToSidekick(),
});

// Define procedure implementations
server.defineProcedure('getUser', {
  resources: ({ inputs }) => [`user/${inputs.userId}`],
  procedure: async ({ inputs, derived }) => {
    const user = await derived.db.query.users.findFirst({
      where: eq(users.id, inputs.userId),
    });

    if (!user) {
      error('User not found', 404);
    }

    return {
      id: user.id,
      username: user.username,
    };
  },
});

// ⚠️ CRITICAL: Always call this
server.assertAllDefined();
```

### Layer 3: Client Setup

```typescript
// src/client/client.ts
import { CovenantReactClient } from '@covenant/react';
import { httpClientToServer } from '@covenant/client/interfaces/http';
import { emptyClientToSidekick } from '@covenant/client/interfaces/empty';
import { appCovenant } from '../covenant';

export const client = new CovenantReactClient(appCovenant, {
  serverConnection: httpClientToServer(
    'http://localhost:3000/api/covenant',
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('authToken')}`,
      },
    }
  ),
  sidekickConnection: emptyClientToSidekick(),
});

// React usage
function UserProfile({ userId }: { userId: string }) {
  const user = client.useQuery('getUser', { userId });

  if (user.loading) return <div>Loading...</div>;
  if (user.error) return <div>Error: {user.error.message}</div>;

  return <div>Username: {user.data.username}</div>;
}
```

---

## Authentication Pattern

This is the most common pattern you'll implement. Here's the battle-tested approach:

### Database Schema
```typescript
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

### Auth Utilities
```typescript
// src/server/auth.ts
import { randomBytes } from 'crypto';
import { db } from './db';
import { users, sessions } from '../../drizzle/schema';

export async function validateCredentials(username: string, password: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  // ⚠️ In production: use bcrypt, not plain text!
  return user && user.password === password ? user : null;
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await db.insert(sessions).values({
    id: token,
    userId,
    createdAt: new Date(),
  });
  return token;
}

export async function getUserFromToken(token: string) {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, token),
    with: { user: true },
  });
  return session?.user ?? null;
}
```

### Covenant Definition
```typescript
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
    output: z.object({
      id: z.string(),
      username: z.string(),
    }),
  }),
}
```

### Server Implementation
```typescript
server.defineProcedure('login', {
  resources: () => [],
  procedure: async ({ inputs }) => {
    const user = await validateCredentials(inputs.username, inputs.password);

    if (!user) {
      error('Invalid credentials', 401);
    }

    const token = await createSession(user.id);

    return {
      token,
      userId: user.id,
    };
  },
});

server.defineProcedure('getCurrentUser', {
  resources: ({ ctx }) => {
    if (!ctx.user) return [];
    return [`user/${ctx.user.id}`];
  },
  procedure: async ({ derived }) => {
    const user = derived.requireAuth();
    return {
      id: user.id,
      username: user.username,
    };
  },
});
```

### Client-Side Login Flow
```typescript
async function handleLogin(username: string, password: string) {
  const result = await client.mutate('login', { username, password });

  if (result.success) {
    localStorage.setItem('authToken', result.data.token);
    // Reinitialize client or reload page
    window.location.href = '/';
  } else {
    alert(result.error.message);
  }
}
```

---

## CRUD Pattern

Common pattern for create/read/update/delete operations.

### Resource Naming Strategy
```typescript
// Collection: broad resource name
resources: () => ['todos']

// Item: specific resource name
resources: ({ inputs }) => [`todo/${inputs.id}`]

// Both: mutations should return both collection + item
resources: ({ inputs, outputs, ctx }) => [
  `todos/user/${ctx.user.id}`,  // Collection (filtered by user)
  `todo/${outputs.id}`,          // Specific item
]
```

### Complete CRUD Example
```typescript
// Covenant
procedures: {
  getTodos: query({
    input: z.null(),
    output: z.array(todoSchema),
  }),

  createTodo: mutation({
    input: z.object({ title: z.string() }),
    output: todoSchema,
  }),

  updateTodo: mutation({
    input: z.object({
      id: z.string(),
      title: z.string().optional(),
      completed: z.boolean().optional(),
    }),
    output: todoSchema,
  }),

  deleteTodo: mutation({
    input: z.object({ id: z.string() }),
    output: z.object({ success: z.boolean() }),
  }),
}

// Server
server.defineProcedure('getTodos', {
  resources: ({ ctx }) => {
    if (!ctx.user) return [];
    return [`todos/user/${ctx.user.id}`];
  },
  procedure: async ({ derived }) => {
    const user = derived.requireAuth();
    return await derived.db.query.todos.findMany({
      where: eq(todos.userId, user.id),
    });
  },
});

server.defineProcedure('createTodo', {
  resources: ({ ctx, outputs }) => {
    if (!ctx.user) return [];
    return [`todos/user/${ctx.user.id}`, `todo/${outputs.id}`];
  },
  procedure: async ({ inputs, derived }) => {
    const user = derived.requireAuth();

    const [todo] = await derived.db.insert(todos).values({
      id: randomUUID(),
      userId: user.id,
      title: inputs.title,
      completed: false,
      createdAt: new Date(),
    }).returning();

    return todo;
  },
});

// Similar for updateTodo and deleteTodo...
```

---

## Realtime Channels Pattern

For bidirectional WebSocket communication.

### 1. Setup InternalSidekick

```typescript
// src/server/server.ts
import { InternalSidekick } from '@covenant/sidekick/internal';

export const sidekick = new InternalSidekick();

export const server = new CovenantServer(appCovenant, {
  contextGenerator: /* ... */,
  derivation: /* ... */,
  sidekickConnection: sidekick.getConnectionFromServer(),
});

// ⚠️ CRITICAL: Must set the server callback
sidekick.setServerCallback((channelName, params, data, context) =>
  server.processChannelMessage(channelName, params, data, context)
);

// src/client/client.ts
import { sidekick } from '../server/server'; // For testing
// Or in production, use separate sidekick with httpClientToSidekick

export const client = new CovenantReactClient(appCovenant, {
  serverConnection: /* ... */,
  sidekickConnection: sidekick.getConnectionFromClient(),
});
```

### 2. Define Channel

```typescript
// Covenant
channels: {
  chat: channel({
    clientMessage: z.object({
      content: z.string(),
    }),
    serverMessage: z.object({
      id: z.string(),
      content: z.string(),
      username: z.string(),
      createdAt: z.date(),
    }),
    connectionRequest: z.object({
      username: z.string(),
    }),
    connectionContext: z.object({
      userId: z.string(),
      username: z.string(),
    }),
    params: ['roomId'],  // Scope connections by room
  }),
}
```

### 3. Implement Channel Handlers

```typescript
server.defineChannel('chat', {
  // Called when client connects
  onConnect: async ({ inputs, params, ctx, derived, reject }) => {
    // Note: ctx.user may be undefined with InternalSidekick
    // See Known Issues section below

    // Validate access
    const hasAccess = await checkRoomAccess(params.roomId);
    if (!hasAccess) {
      reject('Access denied', 'client');
    }

    // Return context (stored per connection)
    return {
      userId: inputs.username, // Temporary workaround
      username: inputs.username,
    };
  },

  // Called when client sends message
  onMessage: async ({ inputs, params, context }) => {
    // Save to database
    const message = await db.insert(messages).values({
      id: randomUUID(),
      roomId: params.roomId,
      userId: context.userId,
      content: inputs.content,
      createdAt: new Date(),
    }).returning();

    // Broadcast to all clients in this room
    await server.postChannelMessage('chat', params, {
      id: message[0].id,
      content: inputs.content,
      username: context.username,
      createdAt: message[0].createdAt,
    });
  },
});
```

### 4. Client Usage

```typescript
function ChatRoom({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState('');

  useEffect(() => {
    async function setup() {
      // 1. Connect to channel
      const result = await client.connect(
        'chat',
        { roomId },
        { username: 'Alice' }
      );

      if (!result.success) {
        alert(result.error.message);
        return;
      }

      setToken(result.token);

      // 2. Subscribe to messages
      await client.subscribe(
        'chat',
        { roomId },
        result.token,
        (message) => {
          setMessages(prev => [...prev, message]);
        }
      );
    }

    setup();

    return () => {
      // Cleanup: unsubscribe
    };
  }, [roomId]);

  const handleSend = async () => {
    if (!token || !input) return;

    // 3. Send message
    await client.send('chat', { roomId }, token, { content: input });
    setInput('');
  };

  return (
    <div>
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id}>
            <strong>{msg.username}:</strong> {msg.content}
          </div>
        ))}
      </div>
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={handleSend}>Send</button>
    </div>
  );
}
```

---

## Testing Strategy

### Unit Tests (Fast, Isolated)

```typescript
import { test, expect } from 'bun:test';
import { CovenantClient } from '@covenant/client';
import { directClientToServer } from '@covenant/server/interfaces/direct';
import { emptyClientToSidekick } from '@covenant/client/interfaces/empty';

test('procedure returns correct data', async () => {
  const client = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(server, {
      Authorization: `Bearer ${token}`,  // ⚠️ Flat object, not nested
    }),
    sidekickConnection: emptyClientToSidekick(),
  });

  const result = await client.query('getUser', { userId: '123' });

  expect(result.success).toBe(true);
  expect(result.data.username).toBe('Alice');
  expect(result.resources).toEqual(['user/123']);
});
```

### Testing Resource Invalidation

```typescript
test('mutation triggers query refetch', async () => {
  const results: any[] = [];

  // Listen to query
  const unsubscribe = client.listen('getTodos', null, (result) => {
    results.push(result.data);
  });

  // Wait for initial fetch
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(results).toHaveLength(1);

  // Mutate
  await client.mutate('createTodo', { title: 'Test' });

  // Wait for automatic refetch
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(results).toHaveLength(2); // Automatically refetched!

  unsubscribe();
});
```

### Testing Channels

```typescript
test('channel broadcasts messages', async () => {
  const sidekick = new InternalSidekick();

  // ... setup server with sidekick ...

  sidekick.setServerCallback((channelName, params, data, context) =>
    server.processChannelMessage(channelName, params, data, context)
  );

  const client = new CovenantClient(covenant, {
    serverConnection: directClientToServer(server, {}),
    sidekickConnection: sidekick.getConnectionFromClient(),
  });

  const result = await client.connect('chat', { roomId: 'test' }, { username: 'Alice' });
  expect(result.success).toBe(true);

  const messages: string[] = [];
  await client.subscribe('chat', { roomId: 'test' }, result.token, (msg) => {
    messages.push(msg.content);
  });

  await client.send('chat', { roomId: 'test' }, result.token, { content: 'Hello!' });
  await new Promise(resolve => setTimeout(resolve, 50));

  expect(messages).toEqual(['Hello!']);
});
```

---

## Common Pitfalls

### 1. ❌ Importing Implementation Code in Covenant
```typescript
// ❌ WRONG
import { db } from './server/db';

export const covenant = declareCovenant({
  procedures: {
    getUser: query({
      // ...
    }),
  },
});

// ✅ CORRECT
import { z } from 'zod';

export const covenant = declareCovenant({
  // Only validation schemas!
});
```

### 2. ❌ Forgetting `assertAllDefined()`
```typescript
// ❌ WRONG
server.defineProcedure('getUser', { /* ... */ });
// Missing assertAllDefined()

// ✅ CORRECT
server.defineProcedure('getUser', { /* ... */ });
server.assertAllDefined(); // Will error if any procedures not defined
```

### 3. ❌ Wrong Resource Names
```typescript
// ❌ WRONG: Too generic
resources: () => ['data']

// ❌ WRONG: Not consistent
// Query returns 'users', mutation returns 'user/123'
resources: () => ['users']  // getTodos
resources: () => [`user/${id}`]  // createTodo → Won't trigger refetch!

// ✅ CORRECT: Specific and consistent
resources: ({ ctx }) => [`todos/user/${ctx.user.id}`]  // Both use same name
```

### 4. ❌ Accessing `derived` in `resources` Function
```typescript
// ❌ WRONG: derived is not available in resources function
resources: ({ derived }) => {
  const user = derived.requireAuth();
  return [`user/${user.id}`];
}

// ✅ CORRECT: Use ctx instead
resources: ({ ctx }) => {
  if (!ctx.user) return [];
  return [`user/${ctx.user.id}`];
}
```

### 5. ❌ Wrong Headers for `directClientToServer`
```typescript
// ❌ WRONG: Nested headers
directClientToServer(server, {
  headers: {
    Authorization: 'Bearer token',
  },
})

// ✅ CORRECT: Flat object
directClientToServer(server, {
  Authorization: 'Bearer token',
})
```

### 6. ❌ Not Setting Sidekick Callback
```typescript
// ❌ WRONG: Channels won't work
const sidekick = new InternalSidekick();
const server = new CovenantServer(covenant, {
  sidekickConnection: sidekick.getConnectionFromServer(),
});

// ✅ CORRECT: Must set callback
sidekick.setServerCallback((channelName, params, data, context) =>
  server.processChannelMessage(channelName, params, data, context)
);
```

---

## Channel Authentication Pattern

Channel handlers receive the same `ctx` and `derived` as procedures, enabling full authentication:

```typescript
server.defineChannel('chat', {
  onConnect: async ({ inputs, params, ctx, derived, reject, error }) => {
    // ✅ ctx.user is available - same as procedures!
    const user = derived.requireAuth();

    // Validate access to this specific channel
    const hasPermission = await checkChannelPermission(user.id, params.roomId);
    if (!hasPermission) {
      reject('Access denied to this channel', 'client');
    }

    // Return connection context
    return {
      userId: user.id,
      username: user.username,
    };
  },

  onMessage: async ({ inputs, params, context, derived, error }) => {
    // context = what was returned from onConnect
    // derived is available for database access, etc.

    await derived.db.insert(messages).values({
      roomId: params.roomId,
      userId: context.userId,
      content: inputs.content,
    });

    // Broadcast to all connected clients in this room
    await server.postChannelMessage('chat', params, {
      userId: context.userId,
      username: context.username,
      content: inputs.content,
      timestamp: new Date(),
    });
  },
});
```

**Key Points:**
- `onConnect` receives: `inputs`, `params`, **`ctx`**, **`derived`**, `reject`, `error`
- `onMessage` receives: `inputs`, `params`, `context`, **`derived`**, `error`
- Use `derived.requireAuth()` in `onConnect` just like procedures
- `ctx` has full authentication context from `contextGenerator`
- `context` in `onMessage` is the connectionContext returned from `onConnect`

---

## Resource Function Signature

The `resources` function receives **limited** parameters:
```typescript
resources: ({ ctx, inputs, outputs, logger }) => {
  // ✅ Available:
  // - ctx: Context from contextGenerator
  // - inputs: Validated input data
  // - outputs: Validated output data (only known after procedure runs)
  // - logger: Logger instance

  // ❌ NOT available:
  // - derived: Derivation functions
  // - error: Error throwing function
}
```

**Key insight**: Use `ctx` directly, not `derived`, in resources function.

---

## Quick Checklist

When building a Covenant app, follow this checklist:

- [ ] Created isolated `covenant.ts` with ONLY validation schemas
- [ ] Server has `contextGenerator` for auth
- [ ] Server has `derivation` with common utilities (e.g., `requireAuth`)
- [ ] All procedures defined with `defineProcedure`
- [ ] Called `server.assertAllDefined()`
- [ ] Resources are specific and consistent across related procedures
- [ ] Resources function uses `ctx`, not `derived`
- [ ] Client setup with appropriate connections (empty vs sidekick)
- [ ] If using channels: `sidekick.setServerCallback()` is called
- [ ] Tests use `directClientToServer` for speed
- [ ] Tests verify resource identifiers
- [ ] Tests verify automatic refetch behavior (if using listenedQuery)

---

## Summary of Key Patterns

1. **Three-Layer Separation**: Covenant → Server → Client
2. **Context for Auth**: `contextGenerator` extracts user per-request
3. **Derivation for Utilities**: Shared helpers like `requireAuth()`
4. **Resource Consistency**: Same names across queries and mutations
5. **directClientToServer for Tests**: Fast in-memory testing
6. **InternalSidekick for Realtime**: Enable channels and resource tracking
7. **assertAllDefined**: Catch missing implementations
8. **Channel Params**: Scope connections to specific resources

---

## Examples Reference

- **covenant-hello-world**: Basic auth + single query pattern
- **covenant-todo**: CRUD + resource tracking + listenedQuery
- **covenant-chat**: Channels + broadcasting + params scoping

All examples follow these patterns consistently and include comprehensive tests.

---

Built by Claude based on implementing three production-quality Covenant examples. For more details, see `examples/guide.md` for comprehensive API documentation.
