# Covenant Chat Example

A Discord-like realtime chat application showcasing Covenant RPC's **realtime channels** and bidirectional WebSocket communication.

## Overview

This example demonstrates Covenant's most advanced features:

- **Realtime Channels**: Bidirectional WebSocket communication with typed messages
- **Channel Scoping**: Use params to scope connections to specific rooms
- **Message Broadcasting**: Server broadcasts to all connected clients
- **Connection Validation**: Validate permissions in `onConnect` before allowing access
- **Message Persistence**: Save messages to database while broadcasting in realtime

## Architecture

### Data Model

```
users
  ↓
servers (Discord-like servers)
  ↓
server_members (many-to-many: users ↔ servers)
  ↓
channels (channels within servers)
  ↓
messages (chat messages in channels)
```

### The Covenant Pattern

This example follows the strict three-layer architecture:

1. **Covenant Definition** (`src/covenant.ts`)
   - Defines the API contract
   - Only imports validation schemas (Zod)
   - Declares procedures and channels

2. **Server Implementation** (`src/server/server.ts`)
   - Implements all procedures
   - Implements the `chat` channel with `onConnect` and `onMessage`
   - Uses `InternalSidekick` for WebSocket management
   - Validates authorization at multiple levels

3. **Client Setup** (`src/client/client.ts`)
   - Creates `CovenantReactClient` with server and sidekick connections
   - Used by UI components for queries, mutations, and channel operations

## Key Features Demonstrated

### 1. Channel Definition with Params

```typescript
// In covenant.ts
chat: channel({
  clientMessage: z.object({ content: z.string() }),
  serverMessage: z.object({
    id: z.string(),
    content: z.string(),
    username: z.string(),
    userId: z.string(),
    createdAt: z.date(),
  }),
  connectionRequest: z.object({ username: z.string() }),
  connectionContext: z.object({
    userId: z.string(),
    username: z.string(),
  }),
  // Params scope connections to specific channels
  params: ['serverId', 'channelId'],
})
```

**How params work:**
- Params act like URL parameters, scoping connections to specific resources
- When a client connects to `{ serverId: 'abc', channelId: '123' }`, they only receive messages sent to that exact combination
- This enables isolated chat rooms without manual filtering

### 2. Channel Connection Validation

```typescript
// In server.ts
onConnect: async ({ inputs, params, ctx, derived, reject }) => {
  const user = derived.requireAuth();

  // Verify channel exists and belongs to server
  const channel = await derived.db.query.channels.findFirst({
    where: eq(channels.id, params.channelId),
  });

  if (!channel || channel.serverId !== params.serverId) {
    reject('Channel not found', 'client');
    return null as any;
  }

  // Verify user is member of server
  const membership = await derived.db.query.serverMembers.findFirst({
    where: and(
      eq(serverMembers.serverId, params.serverId),
      eq(serverMembers.userId, user.id)
    ),
  });

  if (!membership) {
    reject('You are not a member of this server', 'client');
    return null as any;
  }

  // Connection approved! Return context for this connection
  return {
    userId: user.id,
    username: inputs.username,
  };
}
```

**Key points:**
- `onConnect` runs BEFORE the connection is established
- Use `reject()` to deny the connection with a fault type ('client', 'server', 'sidekick')
- Return value becomes the `context` available in `onMessage`
- Validate permissions, check database, etc. before allowing access

### 3. Message Broadcasting

```typescript
// In server.ts
onMessage: async ({ inputs, params, context, derived }) => {
  // Save to database
  const messageId = randomBytes(16).toString('hex');
  await derived.db.insert(messages).values({
    id: messageId,
    channelId: params.channelId,
    userId: context.userId,
    content: inputs.content,
    createdAt: new Date(),
  });

  // Broadcast to ALL clients connected to this channel
  await server.postChannelMessage('chat', params, {
    id: messageId,
    content: inputs.content,
    username: context.username,
    userId: context.userId,
    createdAt: new Date(),
  });
}
```

**How broadcasting works:**
- `server.postChannelMessage(channelName, params, data)` sends to all connected clients
- Only clients with matching params receive the message
- If 100 clients are connected but only 5 match `{ serverId: 'abc', channelId: '123' }`, only those 5 receive it
- This is handled automatically by Sidekick based on params

### 4. Client-Side Channel Usage

```typescript
// In UI component
useEffect(() => {
  const connectAndSubscribe = async () => {
    // 1. Connect to channel
    const result = await client.connect(
      'chat',
      { serverId, channelId },  // params
      { username: 'Alice' }      // connectionRequest
    );

    if (!result.success) {
      setError(result.error.message);
      return;
    }

    // 2. Subscribe to receive messages
    const unsubscribe = await client.subscribe(
      'chat',
      { serverId, channelId },
      result.token,
      (message) => {
        // This callback runs whenever a message is broadcast
        setMessages(prev => [...prev, message]);
      }
    );

    setToken(result.token);
    return unsubscribe;
  };

  const cleanup = connectAndSubscribe();

  return () => {
    cleanup.then(unsub => unsub?.());
  };
}, [serverId, channelId]);

// 3. Send messages
const handleSend = async () => {
  await client.send(
    'chat',
    { serverId, channelId },
    token,
    { content: messageInput }
  );
};
```

**Client flow:**
1. `connect()` - Establishes connection, server runs `onConnect`, returns token
2. `subscribe()` - Starts listening for messages, provides callback
3. `send()` - Sends message, server runs `onMessage`, broadcasts to all
4. Cleanup - Unsubscribe when component unmounts

## Project Structure

```
examples/covenant-chat/
├── src/
│   ├── covenant.ts                 # Shared covenant definition
│   ├── server/
│   │   ├── server.ts               # CovenantServer + channel handlers
│   │   ├── auth.ts                 # Authentication utilities
│   │   └── db.ts                   # Drizzle database setup
│   ├── client/
│   │   └── client.ts               # CovenantReactClient
│   └── app/                        # Next.js app
│       ├── page.tsx                # Server list
│       ├── login/page.tsx          # Login page
│       └── server/[serverId]/channel/[channelId]/
│           └── page.tsx            # Chat room with realtime messaging
├── tests/
│   ├── unit/
│   │   ├── procedures.test.ts     # Unit tests for all procedures
│   │   └── channels.test.ts       # Unit tests for channel behavior
│   └── integration/
│       └── realtime.test.ts       # End-to-end realtime chat test
├── drizzle/
│   └── schema.ts                  # Database schema
└── package.json
```

## Running the Example

### Setup

```bash
cd examples/covenant-chat
bun install
```

### Development

```bash
bun run dev
```

Visit http://localhost:3000 and log in with:
- Username: `alice` or `bob`
- Password: `password`

### Testing

Run unit and integration tests:

```bash
bun test
```

## Key Learnings

### 1. Channel Params Provide Scoping

Without params, all clients would receive all messages. With params:

```typescript
// Client A connects with { serverId: '1', channelId: '2' }
// Client B connects with { serverId: '1', channelId: '3' }
// Client C connects with { serverId: '1', channelId: '2' }

// When server broadcasts to { serverId: '1', channelId: '2' }:
// → Client A receives ✓
// → Client B does NOT receive ✗
// → Client C receives ✓
```

This is how Discord, Slack, and similar apps work - each room is isolated.

### 2. onConnect vs onMessage

- **`onConnect`**: Runs ONCE when client connects
  - Validate permissions
  - Check database for access rights
  - Return context that persists for the connection
  - Use `reject()` to deny access

- **`onMessage`**: Runs EVERY TIME client sends a message
  - Process the message
  - Save to database
  - Broadcast to other clients
  - Access connection context from `onConnect`

### 3. InternalSidekick Setup

**CRITICAL**: You must set the server callback for channels to work:

```typescript
const sidekick = new InternalSidekick();

const server = new CovenantServer(covenant, {
  sidekickConnection: sidekick.getConnectionFromServer(),
  // ...
});

// Without this, channel messages won't be processed!
sidekick.setServerCallback((channelName, params, data, context) =>
  server.processChannelMessage(channelName, params, data, context)
);
```

### 4. Broadcasting vs Persistence

The server should do BOTH:

```typescript
onMessage: async ({ inputs, params, context }) => {
  // 1. Save to database (persistence)
  await db.insert(messages).values({ ... });

  // 2. Broadcast to all clients (realtime)
  await server.postChannelMessage('chat', params, { ... });
}
```

This ensures:
- New clients can load history from database
- Connected clients receive messages in realtime
- Messages aren't lost if broadcast fails

### 5. Hierarchical Authorization

This example shows multi-level auth:

1. **User must be authenticated** (checked in all procedures/channels)
2. **User must be member of server** (checked in channel procedures)
3. **Channel must belong to server** (prevents channel ID spoofing)

Always validate at every level - don't assume client sends correct params!

## Testing Strategy

### Unit Tests (`tests/unit/`)

- **procedures.test.ts**: Tests all 6 procedures independently
  - Login, server CRUD, channel CRUD, message history
  - Authorization checks for each operation

- **channels.test.ts**: Tests channel behavior
  - Connection validation (membership checks)
  - Message broadcasting to single/multiple clients
  - Message persistence
  - Channel scoping (messages don't leak between channels)

### Integration Tests (`tests/integration/`)

- **realtime.test.ts**: Full user flow
  - Two users log in
  - Create server and channel
  - Both connect to channel
  - Exchange messages in realtime
  - Verify persistence

### Key Test Patterns

Use `InternalSidekick` and `directClientToServer` for testing:

```typescript
const sidekick = new InternalSidekick();

const server = new CovenantServer(covenant, {
  sidekickConnection: sidekick.getConnectionFromServer(),
  // ...
});

sidekick.setServerCallback((channelName, params, data, context) =>
  server.processChannelMessage(channelName, params, data, context)
);

const client = new CovenantClient(covenant, {
  serverConnection: directClientToServer(server, {}),
  sidekickConnection: sidekick.getConnectionFromClient(),
});
```

This bypasses HTTP and tests the server logic directly.

## Common Patterns

### Pattern 1: Loading Chat History + Realtime Updates

```typescript
// Load initial history
const history = client.useQuery('getMessages', { channelId });

// Set up realtime updates
const [realtimeMessages, setRealtimeMessages] = useState([]);

useEffect(() => {
  // Connect and subscribe...
  client.subscribe('chat', params, token, (msg) => {
    setRealtimeMessages(prev => [...prev, msg]);
  });
}, [channelId]);

// Combine both
const allMessages = [...(history.data || []), ...realtimeMessages];
```

### Pattern 2: Handling Connection Failures

```typescript
const [connectionError, setConnectionError] = useState(null);

const connectResult = await client.connect('chat', params, inputs);

if (!connectResult.success) {
  setConnectionError(connectResult.error.message);
  // Show error to user, maybe retry button
  return;
}

// Success - set up subscription
```

### Pattern 3: Cleanup on Unmount

```typescript
useEffect(() => {
  let unsubscribe: (() => void) | null = null;

  const setup = async () => {
    const result = await client.connect(...);
    if (result.success) {
      unsubscribe = await client.subscribe(...);
    }
  };

  setup();

  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
}, [serverId, channelId]);
```

## Differences from Other Examples

| Feature | hello-world | todo | **chat** |
|---------|-------------|------|----------|
| Procedures | ✓ | ✓ | ✓ |
| Mutations | ✓ | ✓ | ✓ |
| Resource Tracking | - | ✓ | ✓ |
| **Realtime Channels** | - | - | **✓** |
| **WebSocket** | - | - | **✓** |
| **Bidirectional Communication** | - | - | **✓** |
| Database | - | SQLite | SQLite |
| Relations | - | Simple | **Complex (5 tables)** |
| **Authorization Layers** | Basic | Simple | **Multi-level** |

## Production Considerations

### 1. WebSocket Deployment

This example uses `InternalSidekick` for simplicity. In production:

```typescript
// Use HTTP sidekick service for edge deployments
import { httpServerToSidekick } from '@covenant/server/interfaces/http';
import { httpClientToSidekick } from '@covenant/client/interfaces/http';

// Server (edge)
const server = new CovenantServer(covenant, {
  sidekickConnection: httpServerToSidekick(
    'https://sidekick.example.com',
    'your-secret-key'
  ),
});

// Client (browser)
const client = new CovenantClient(covenant, {
  sidekickConnection: httpClientToSidekick('wss://sidekick.example.com'),
});
```

### 2. Message Pagination

Add pagination to `getMessages`:

```typescript
getMessages: query({
  input: z.object({
    channelId: z.string(),
    limit: z.number().optional(),
    before: z.string().optional(),  // Message ID
  }),
  // ...
})
```

### 3. Presence/Typing Indicators

Use channels for presence too:

```typescript
presence: channel({
  clientMessage: z.object({ status: z.enum(['typing', 'online', 'idle']) }),
  serverMessage: z.object({ userId: z.string(), status: z.string() }),
  params: ['channelId'],
})
```

### 4. Rate Limiting

Add rate limiting in `onMessage`:

```typescript
onMessage: async ({ context }) => {
  const messageCount = await getRecentMessageCount(context.userId);
  if (messageCount > 10) {
    error('Rate limit exceeded', 429);
  }
  // ...
}
```

## Troubleshooting

### "Channel not receiving messages"

1. Check that `sidekick.setServerCallback()` is called
2. Verify params match exactly between `connect()` and `postChannelMessage()`
3. Check browser console for WebSocket errors

### "Connection rejected"

1. Check that user is authenticated (token in Authorization header)
2. Verify user is member of server
3. Check that channel exists and belongs to server

### "Messages appear multiple times"

1. Make sure to clean up subscriptions with `unsubscribe()`
2. Don't call `subscribe()` multiple times without cleanup
3. Use dependency array in `useEffect()` correctly

## Summary

This example showcases Covenant's **realtime channels** - the framework's most powerful feature for bidirectional WebSocket communication. Key concepts:

- **Channels** enable realtime, typed, bidirectional communication
- **Params** scope connections to specific resources (like rooms)
- **onConnect** validates access before connection is established
- **onMessage** processes messages and broadcasts to all clients
- **InternalSidekick** manages WebSocket connections and broadcasting
- **Broadcasting** sends messages to all connected clients with matching params

The chat example demonstrates how to build Discord-like applications with Covenant, showing the full power of type-safe realtime communication.
