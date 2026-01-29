# Covenant Chat Example - Implementation Plan

## Overview
A realtime chat application demonstrating Covenant RPC channels with bidirectional WebSocket communication. Similar to Discord - users can create servers, channels within servers, and send messages in real-time.

## Project Structure
```
examples/covenant-chat/
├── src/
│   ├── covenant.ts                 # Shared covenant definition
│   ├── server/
│   │   ├── server.ts               # CovenantServer with channels
│   │   ├── auth.ts                 # Authentication utilities
│   │   └── db.ts                   # Drizzle setup with SQLite
│   ├── client/
│   │   └── client.ts               # CovenantReactClient with Sidekick
│   └── app/                        # Next.js app directory
│       ├── layout.tsx              # Root layout
│       ├── page.tsx                # Server list
│       ├── login/
│       │   └── page.tsx            # Login page
│       ├── server/
│       │   └── [serverId]/
│       │       └── channel/
│       │           └── [channelId]/
│       │               └── page.tsx # Chat room
│       └── api/
│           └── covenant/
│               └── route.ts        # API route handler
├── tests/
│   ├── unit/
│   │   ├── procedures.test.ts     # Unit tests for procedures
│   │   └── channels.test.ts       # Unit tests for channels
│   ├── integration/
│   │   ├── server.test.ts         # Integration tests
│   │   └── realtime.test.ts       # Test realtime messaging
│   └── e2e/
│       └── chat.spec.ts           # Playwright e2e tests
├── drizzle/
│   └── schema.ts                  # Database schema
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
- **Sidekick**: InternalSidekick for channels

## Database Schema

### Tables
1. **users**: id, username, password
2. **servers**: id, name, ownerId, createdAt
3. **server_members**: id, serverId, userId, joinedAt (foreign keys to servers and users)
4. **channels**: id, serverId, name, createdAt (foreign key to servers)
5. **messages**: id, channelId, userId, content, createdAt (foreign keys to channels and users)

### Relationships
- Server has many members (users)
- Server has many channels
- Channel has many messages
- User can be member of many servers
- User can send many messages

## Feature Requirements

### 1. Authentication
- Reuse auth from previous examples
- Username/password login
- Token-based sessions

### 2. Server Management Procedures

**`getServers` query**
- Input: none (uses user from context)
- Output: array of servers the user is a member of
- Resource: `servers/user/${userId}`

**`createServer` mutation**
- Input: `{ name: string }`
- Output: created server
- Automatically adds creator as member
- Resource: `servers/user/${userId}`, `server/${serverId}`

**`joinServer` mutation** (optional for MVP)
- Input: `{ serverId: string }`
- Output: `{ success: boolean }`
- Resource: `servers/user/${userId}`, `server/${serverId}`

### 3. Channel Management Procedures

**`getChannels` query**
- Input: `{ serverId: string }`
- Output: array of channels in the server
- Verify user is member of server
- Resource: `channels/server/${serverId}`

**`createChannel` mutation**
- Input: `{ serverId: string, name: string }`
- Output: created channel
- Verify user is member of server
- Resource: `channels/server/${serverId}`, `channel/${channelId}`

### 4. Message History Procedure

**`getMessages` query**
- Input: `{ channelId: string, limit?: number }`
- Output: array of recent messages
- Verify user is member of the server
- Resource: `messages/channel/${channelId}`

### 5. Realtime Chat Channel

**`chat` channel** - The key feature!
- **clientMessage**: `{ content: string }`
- **serverMessage**: `{ id: string, content: string, username: string, userId: string, createdAt: Date }`
- **connectionRequest**: `{ username: string }` (could include last seen message ID)
- **connectionContext**: `{ userId: string, username: string }`
- **params**: `["serverId", "channelId"]` - scope to specific channel

**Channel Implementation**:
- `onConnect`: Verify user is member of server, return context with userId and username
- `onMessage`: Save message to database, broadcast to all connected clients in that channel
- Use `server.postChannelMessage()` to broadcast

### 6. UI Components

**Server List Page** (`/`):
- Show list of servers user is a member of
- Form to create new server
- Click server to navigate to channel list

**Channel List + Chat Page** (`/server/[serverId]/channel/[channelId]`):
- Sidebar: List of channels in server
  - Form to create new channel
- Main area: Chat room
  - Load recent messages with `getMessages`
  - Connect to `chat` channel
  - Subscribe to receive new messages in real-time
  - Form to send message
  - Display messages with username and timestamp
  - Auto-scroll to bottom on new message

### 7. Testing Coverage

**Unit Tests**:
- Test all procedures (server/channel CRUD)
- Test channel onConnect validates membership
- Test channel onMessage saves and broadcasts

**Integration Tests**:
- Test full flow: create server → create channel → send message
- Test message history retrieval
- Test realtime message delivery

**E2E Tests**:
- Test: Create server → create channel → send message → see it appear
- Test: Two users in same channel see each other's messages (if possible)
- Test: User not in server can't access channel

## Implementation Steps

### Step 1: Project Setup
1. Create directory structure
2. Initialize package.json with dependencies
3. Create tsconfig.json
4. Create playwright.config.ts

### Step 2: Database Schema
1. Create drizzle/schema.ts with all 5 tables
2. Set up foreign keys and indexes
3. Create drizzle.config.ts
4. Set up database connection in src/server/db.ts
5. Create seed script for test data

### Step 3: Covenant Definition
1. Create src/covenant.ts with:
   - `login` mutation
   - `getServers` query
   - `createServer` mutation
   - `getChannels` query
   - `createChannel` mutation
   - `getMessages` query
   - `chat` channel with params `["serverId", "channelId"]`

### Step 4: Server Implementation
1. Create src/server/auth.ts (reuse from previous examples)
2. Create src/server/server.ts:
   - Initialize `InternalSidekick`
   - Create `CovenantServer` with sidekick connection
   - Set server callback
   - Implement all procedures with proper authorization checks
   - Implement `chat` channel:
     ```typescript
     server.defineChannel('chat', {
       onConnect: async ({ inputs, params, ctx, derived, reject }) => {
         const user = derived.requireAuth();

         // Verify user is member of the server
         const member = await db.query.serverMembers.findFirst({
           where: and(
             eq(serverMembers.serverId, params.serverId),
             eq(serverMembers.userId, user.id)
           ),
         });

         if (!member) {
           reject('You are not a member of this server', 'client');
         }

         return {
           userId: user.id,
           username: user.username,
         };
       },

       onMessage: async ({ inputs, params, context }) => {
         // Save message to database
         const message = await db.insert(messages).values({
           channelId: params.channelId,
           userId: context.userId,
           content: inputs.content,
           createdAt: new Date(),
         }).returning();

         // Broadcast to all clients in this channel
         await server.postChannelMessage('chat', params, {
           id: message[0].id,
           content: inputs.content,
           username: context.username,
           userId: context.userId,
           createdAt: message[0].createdAt,
         });
       },
     });
     ```
   - Call `assertAllDefined()`

### Step 5: Client Setup
1. Create src/client/client.ts:
   - Use same InternalSidekick instance
   - Create CovenantReactClient with sidekick connection
   - Auth token management
   - Helper functions for channel operations

### Step 6: Next.js API Route
1. Create src/app/api/covenant/route.ts

### Step 7: UI Components

**Layout and Auth**:
1. Create src/app/layout.tsx
2. Create src/app/login/page.tsx

**Server List**:
3. Create src/app/page.tsx:
   - Use `useListenedQuery('getServers', null)`
   - Display server list
   - Form to create new server
   - Navigate to first channel when clicking server

**Chat Room**:
4. Create src/app/server/[serverId]/channel/[channelId]/page.tsx:
   - Use `useQuery('getChannels', { serverId })` for channel list
   - Use `useQuery('getMessages', { channelId })` for initial message history
   - Use channel connection for realtime:
     ```typescript
     useEffect(() => {
       const connectAndSubscribe = async () => {
         // Connect to channel
         const result = await client.connect(
           'chat',
           { serverId, channelId },
           { username: currentUser.username }
         );

         if (result.success) {
           setToken(result.token);

           // Subscribe to messages
           await client.subscribe(
             'chat',
             { serverId, channelId },
             result.token,
             (message) => {
               setMessages(prev => [...prev, message]);
             }
           );
         }
       };

       connectAndSubscribe();

       return () => {
         // Cleanup subscription
       };
     }, [serverId, channelId]);
     ```
   - Form to send message:
     ```typescript
     const handleSend = async () => {
       await client.send(
         'chat',
         { serverId, channelId },
         token,
         { content: message }
       );
       setMessage('');
     };
     ```

### Step 8: Unit Tests
1. Create tests/unit/procedures.test.ts:
   - Test server CRUD
   - Test channel CRUD
   - Test message history
   - Test authorization (can't access other user's servers)

2. Create tests/unit/channels.test.ts:
   - Test channel connection with valid membership
   - Test channel connection rejected without membership
   - Test message sending
   - Test message broadcasting

### Step 9: Integration Tests
1. Create tests/integration/server.test.ts:
   - Test full flow: create server → create channel → get messages

2. Create tests/integration/realtime.test.ts:
   - **Critical test**: Two clients in same channel
   - Client A connects and subscribes
   - Client B connects and sends message
   - Verify Client A receives the message
   - Test message persistence (disconnect → reconnect → see history)

### Step 10: E2E Tests
1. Create tests/e2e/chat.spec.ts:
   - Test: Create server → create channel → send message → see it
   - Test: Load message history on page load
   - Test: Messages appear in real-time
   - Test: Multiple channels don't interfere with each other

### Step 11: Documentation
1. Create README.md with:
   - Architecture diagram showing channel flow
   - Explanation of channel params (serverId, channelId)
   - How onConnect validates membership
   - How onMessage broadcasts to all clients
   - Setup and run instructions

## Key Patterns to Demonstrate

### 1. Channel Definition with Params
```typescript
// Covenant
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
  params: ['serverId', 'channelId'],  // Typed params!
}),
```

### 2. Channel Connection Validation
```typescript
// Server
onConnect: async ({ params, derived, reject }) => {
  const user = derived.requireAuth();

  // Verify membership
  const member = await checkMembership(user.id, params.serverId);
  if (!member) {
    reject('Not a member', 'client');
  }

  return { userId: user.id, username: user.username };
}
```

### 3. Broadcasting Messages
```typescript
// Server
onMessage: async ({ inputs, params, context }) => {
  // Save to DB
  await saveMessage(params.channelId, context.userId, inputs.content);

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

### 4. Client-Side Channel Usage
```typescript
// 1. Connect
const result = await client.connect(
  'chat',
  { serverId: '123', channelId: '456' },  // params
  { username: 'Alice' }                    // connectionRequest
);

// 2. Subscribe
await client.subscribe(
  'chat',
  { serverId: '123', channelId: '456' },
  result.token,
  (message) => {
    console.log(`${message.username}: ${message.content}`);
  }
);

// 3. Send
await client.send(
  'chat',
  { serverId: '123', channelId: '456' },
  result.token,
  { content: 'Hello!' }
);
```

### 5. Hierarchical Authorization
```typescript
// Check authorization at multiple levels:
// 1. User must be authenticated
// 2. User must be member of server
// 3. Channel must belong to server
```

## Testing Strategy

### Unit Tests
- Test channel onConnect with/without membership
- Test channel onMessage saves to DB
- Test procedures enforce authorization
- Test with mock database

### Integration Tests
- **Critical**: Test message broadcasting to multiple clients
- Test channel params scoping (messages in channel A don't go to channel B)
- Test connection lifecycle (connect → disconnect → reconnect)
- Test with real InternalSidekick

### E2E Tests
- Test real browser interactions
- Test realtime message updates in UI
- Test multiple channels
- Test error states (connection failed, etc.)

## Dependencies

Same as covenant-todo, plus any UI dependencies needed for chat interface.

## Success Criteria

- ✅ User can create servers and channels
- ✅ User can send messages that appear in real-time
- ✅ Multiple users in same channel see each other's messages
- ✅ Messages persist in database
- ✅ Channel params properly scope connections
- ✅ Authorization prevents unauthorized access
- ✅ All unit tests pass
- ✅ All integration tests pass (including realtime)
- ✅ All e2e tests pass
- ✅ Code follows Covenant patterns from guide.md
- ✅ README clearly explains channel architecture

## Potential Covenant Issues to Watch For

- Channel params type inference
- postChannelMessage parameter order and types
- Connection token lifecycle
- Subscription cleanup and memory leaks
- Message serialization (especially Date objects via Ion)
- Multiple simultaneous connections to same channel
- Connection rejection vs error handling
- InternalSidekick callback setup with channels
- Channel message broadcasting scope

## Key Differences from Previous Examples

1. **Channels**: First example using realtime bidirectional communication
2. **Params**: Demonstrates channel scoping with typed params
3. **Broadcasting**: Shows how to broadcast to all connected clients
4. **Complex Schema**: 5 tables with multiple foreign keys
5. **Hierarchical Auth**: Multi-level authorization (user → server → channel)
6. **Connection Lifecycle**: Connect → subscribe → send → disconnect
7. **Real-time UI**: Messages appear instantly without polling

This is the most advanced example, showcasing Covenant's full capabilities for realtime applications.
