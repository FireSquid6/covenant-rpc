import { test, expect, beforeAll, afterAll } from 'bun:test';
import { CovenantServer } from '@covenant/server';
import { CovenantClient } from '@covenant/client';
import { InternalSidekick } from '@covenant/sidekick/internal';
import { directClientToServer } from '@covenant/server/interfaces/direct';
import { appCovenant } from '../../src/covenant';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from '../../drizzle/schema';
import { randomBytes } from 'crypto';
import { eq, and } from 'drizzle-orm';

/**
 * Unit tests for realtime chat channel
 *
 * These tests verify:
 * - Channel connection validation (membership check)
 * - Message sending and saving to database
 * - Message broadcasting to all connected clients
 * - Channel scoping by params (serverId, channelId)
 *
 * This demonstrates Covenant's key realtime capability!
 */

let testDb: ReturnType<typeof drizzle>;
let testSqlite: Database;
let testSidekick: InternalSidekick;
let testServer: CovenantServer<typeof appCovenant, any, any>;

const testUserId1 = 'test-user-1';
const testUserId2 = 'test-user-2';

beforeAll(() => {
  // Create in-memory database
  testSqlite = new Database(':memory:');
  testDb = drizzle(testSqlite, { schema });

  // Initialize tables (abbreviated for brevity)
  testSqlite.run(`CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, created_at INTEGER NOT NULL)`);
  testSqlite.run(`CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
  testSqlite.run(`CREATE TABLE servers (id TEXT PRIMARY KEY, name TEXT NOT NULL, owner_id TEXT NOT NULL, created_at INTEGER NOT NULL, FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE)`);
  testSqlite.run(`CREATE TABLE server_members (id TEXT PRIMARY KEY, server_id TEXT NOT NULL, user_id TEXT NOT NULL, joined_at INTEGER NOT NULL, FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
  testSqlite.run(`CREATE TABLE channels (id TEXT PRIMARY KEY, server_id TEXT NOT NULL, name TEXT NOT NULL, created_at INTEGER NOT NULL, FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE)`);
  testSqlite.run(`CREATE TABLE messages (id TEXT PRIMARY KEY, channel_id TEXT NOT NULL, user_id TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL, FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);

  // Create test users
  testDb.insert(schema.users).values([
    { id: testUserId1, username: 'alice', password: 'password', createdAt: new Date() },
    { id: testUserId2, username: 'bob', password: 'password', createdAt: new Date() },
  ]).run();

  // Setup Sidekick
  testSidekick = new InternalSidekick();

  // Setup server
  testServer = new CovenantServer(appCovenant, {
    contextGenerator: async ({ request }) => {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader) return { user: null };

      const token = authHeader.replace('Bearer ', '');
      const session = await testDb.query.sessions.findFirst({
        where: eq(schema.sessions.token, token),
      });

      if (!session || session.expiresAt < new Date()) return { user: null };

      const user = await testDb.query.users.findFirst({
        where: eq(schema.users.id, session.userId),
      });

      if (!user) return { user: null };

      return { user: { id: user.id, username: user.username } };
    },
    derivation: ({ ctx, error }) => ({
      requireAuth: () => {
        if (!ctx.user) error('Unauthorized', 401);
        return ctx.user;
      },
      db: testDb,
    }),
    sidekickConnection: testSidekick.getConnectionFromServer(),
  });

  // CRITICAL: Set server callback for channels to work
  testSidekick.setServerCallback((channelName, params, data, context) =>
    testServer.processChannelMessage(channelName, params, data, context)
  );

  // Define minimal procedures needed for tests
  testServer.defineProcedure('login', {
    resources: () => [],
    procedure: async ({ inputs, error }) => {
      const user = await testDb.query.users.findFirst({
        where: eq(schema.users.username, inputs.username),
      });
      if (!user || user.password !== inputs.password) {
        error('Invalid username or password', 401);
      }
      const token = randomBytes(32).toString('hex');
      const sessionId = randomBytes(16).toString('hex');
      await testDb.insert(schema.sessions).values({
        id: sessionId,
        userId: user.id,
        token,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      return { token, userId: user.id, username: user.username };
    },
  });

  testServer.defineProcedure('getServers', {
    resources: ({ ctx }) => ctx.user ? [`servers/user/${ctx.user.id}`] : [],
    procedure: async ({ derived }) => {
      const user = derived.requireAuth();
      const memberships = await derived.db.query.serverMembers.findMany({
        where: eq(schema.serverMembers.userId, user.id),
        with: { server: true },
      });
      return memberships.map((m: any) => ({
        id: m.server.id,
        name: m.server.name,
        ownerId: m.server.ownerId,
        createdAt: m.server.createdAt,
      }));
    },
  });

  testServer.defineProcedure('createServer', {
    resources: ({ ctx, outputs }) => ctx.user ? [`servers/user/${ctx.user.id}`, `server/${outputs.id}`] : [],
    procedure: async ({ inputs, derived }) => {
      const user = derived.requireAuth();
      const serverId = randomBytes(16).toString('hex');
      const now = new Date();
      const newServer = { id: serverId, name: inputs.name, ownerId: user.id, createdAt: now };
      await derived.db.insert(schema.servers).values(newServer);
      await derived.db.insert(schema.serverMembers).values({
        id: randomBytes(16).toString('hex'),
        serverId,
        userId: user.id,
        joinedAt: now,
      });
      return newServer;
    },
  });

  testServer.defineProcedure('getChannels', {
    resources: ({ inputs }) => [`channels/server/${inputs.serverId}`],
    procedure: async ({ inputs, derived, error }) => {
      const user = derived.requireAuth();
      const membership = await derived.db.query.serverMembers.findFirst({
        where: and(
          eq(schema.serverMembers.serverId, inputs.serverId),
          eq(schema.serverMembers.userId, user.id)
        ),
      });
      if (!membership) error('Unauthorized', 403);
      return await derived.db.query.channels.findMany({
        where: eq(schema.channels.serverId, inputs.serverId),
      });
    },
  });

  testServer.defineProcedure('createChannel', {
    resources: ({ inputs, outputs }) => [`channels/server/${inputs.serverId}`, `channel/${outputs.id}`],
    procedure: async ({ inputs, derived, error }) => {
      const user = derived.requireAuth();
      const membership = await derived.db.query.serverMembers.findFirst({
        where: and(
          eq(schema.serverMembers.serverId, inputs.serverId),
          eq(schema.serverMembers.userId, user.id)
        ),
      });
      if (!membership) error('Unauthorized', 403);
      const channelId = randomBytes(16).toString('hex');
      const newChannel = {
        id: channelId,
        serverId: inputs.serverId,
        name: inputs.name,
        createdAt: new Date(),
      };
      await derived.db.insert(schema.channels).values(newChannel);
      return newChannel;
    },
  });

  testServer.defineProcedure('getMessages', {
    resources: ({ inputs }) => [`messages/channel/${inputs.channelId}`],
    procedure: async ({ inputs, derived, error }) => {
      const user = derived.requireAuth();
      const channel = await derived.db.query.channels.findFirst({
        where: eq(schema.channels.id, inputs.channelId),
      });
      if (!channel) error('Channel not found', 404);
      const membership = await derived.db.query.serverMembers.findFirst({
        where: and(
          eq(schema.serverMembers.serverId, channel.serverId),
          eq(schema.serverMembers.userId, user.id)
        ),
      });
      if (!membership) error('Unauthorized', 403);
      const channelMessages = await derived.db.query.messages.findMany({
        where: eq(schema.messages.channelId, inputs.channelId),
        orderBy: (messages, { desc }) => [desc(messages.createdAt)],
        limit: inputs.limit || 50,
        with: { user: true },
      });
      return channelMessages.map((msg: any) => ({
        id: msg.id,
        channelId: msg.channelId,
        userId: msg.userId,
        username: msg.user.username,
        content: msg.content,
        createdAt: msg.createdAt,
      })).reverse();
    },
  });

  /**
   * CHAT CHANNEL DEFINITION - The star of the show!
   * This demonstrates Covenant's realtime bidirectional communication
   */
  testServer.defineChannel('chat', {
    /**
     * onConnect: Validate connection and return context
     * This is called when a client connects to the channel
     */
    onConnect: async ({ inputs, params, ctx, reject }) => {
      // Check if user is authenticated
      if (!ctx.user) {
        reject('Unauthorized', 'client');
        return null as any;
      }

      const user = ctx.user;

      // Verify channel exists
      const channel = await testDb.query.channels.findFirst({
        where: eq(schema.channels.id, params.channelId),
      });

      if (!channel) {
        reject('Channel not found', 'client');
        return null as any;
      }

      // Verify channel belongs to server
      if (channel.serverId !== params.serverId) {
        reject('Channel does not belong to this server', 'client');
        return null as any;
      }

      // Verify user is member of server
      const membership = await testDb.query.serverMembers.findFirst({
        where: and(
          eq(schema.serverMembers.serverId, params.serverId),
          eq(schema.serverMembers.userId, user.id)
        ),
      });

      if (!membership) {
        reject('You are not a member of this server', 'client');
        return null as any;
      }

      // Connection is valid! Return context
      return {
        userId: user.id,
        username: inputs.username,
      };
    },

    /**
     * onMessage: Process and broadcast messages
     * This is called when a client sends a message
     */
    onMessage: async ({ inputs, params, context }) => {
      // Save message to database
      const messageId = randomBytes(16).toString('hex');
      const now = new Date();

      await testDb.insert(schema.messages).values({
        id: messageId,
        channelId: params.channelId,
        userId: context.userId,
        content: inputs.content,
        createdAt: now,
      });

      // Broadcast to ALL clients connected to this channel
      // The params (serverId, channelId) ensure only clients in this specific channel receive it
      await testServer.postChannelMessage('chat', params, {
        id: messageId,
        content: inputs.content,
        username: context.username,
        userId: context.userId,
        createdAt: now,
      });
    },
  });

  testServer.assertAllDefined();
});

afterAll(() => {
  testSqlite.close();
});

// Helper to create authenticated client
async function createAuthClient(username: string) {
  const unauthClient = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {}),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  const loginResult = await unauthClient.mutate('login', {
    username,
    password: 'password',
  });

  if (!loginResult.success) throw new Error('Login failed');

  return new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {
      Authorization: `Bearer ${loginResult.data.token}`,
    }),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });
}

// Helper to setup test server and channel
async function setupServerAndChannel(client: CovenantClient<typeof appCovenant>) {
  const serverResult = await client.mutate('createServer', { name: 'Test Server' });
  if (!serverResult.success) throw new Error('Failed to create server');
  const serverId = serverResult.data.id;

  const channelResult = await client.mutate('createChannel', {
    serverId,
    name: 'general',
  });
  if (!channelResult.success) throw new Error('Failed to create channel');
  const channelId = channelResult.data.id;

  return { serverId, channelId };
}

/**
 * Channel Connection Tests
 */
test('channel connection - success with valid membership', async () => {
  const client = await createAuthClient('alice');
  const { serverId, channelId } = await setupServerAndChannel(client);

  const result = await client.connect(
    'chat',
    { serverId, channelId },
    { username: 'alice' }
  );

  expect(result.success).toBe(true);
  expect(result.token).toBeTruthy();
});

test('channel connection - rejects without membership', async () => {
  const aliceClient = await createAuthClient('alice');
  const bobClient = await createAuthClient('bob');

  // Alice creates server and channel
  const { serverId, channelId } = await setupServerAndChannel(aliceClient);

  // Bob tries to connect (not a member)
  const result = await bobClient.connect(
    'chat',
    { serverId, channelId },
    { username: 'bob' }
  );

  expect(result.success).toBe(false);
  expect(result.error.message).toContain('not a member');
});

test('channel connection - rejects for non-existent channel', async () => {
  const client = await createAuthClient('alice');
  const { serverId } = await setupServerAndChannel(client);

  const result = await client.connect(
    'chat',
    { serverId, channelId: 'non-existent-channel' },
    { username: 'alice' }
  );

  expect(result.success).toBe(false);
  expect(result.error.message).toContain('not found');
});

/**
 * Message Broadcasting Tests - The Key Feature!
 */
test('message broadcasting - single client receives own message', async () => {
  const client = await createAuthClient('alice');
  const { serverId, channelId } = await setupServerAndChannel(client);

  // Connect to channel
  const connectResult = await client.connect(
    'chat',
    { serverId, channelId },
    { username: 'alice' }
  );
  expect(connectResult.success).toBe(true);
  const token = connectResult.token;

  // Collect received messages
  const receivedMessages: any[] = [];

  // Subscribe to receive messages
  await client.subscribe(
    'chat',
    { serverId, channelId },
    token,
    (message) => {
      receivedMessages.push(message);
    }
  );

  // Send a message
  await client.send(
    'chat',
    { serverId, channelId },
    token,
    { content: 'Hello, world!' }
  );

  // Wait for message to be broadcast
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Verify message was received
  expect(receivedMessages).toHaveLength(1);
  expect(receivedMessages[0].content).toBe('Hello, world!');
  expect(receivedMessages[0].username).toBe('alice');
  expect(receivedMessages[0].userId).toBe(testUserId1);
});

test('message broadcasting - multiple clients receive messages', async () => {
  const aliceClient = await createAuthClient('alice');
  const bobClient = await createAuthClient('bob');

  // Alice creates server and channel
  const { serverId, channelId } = await setupServerAndChannel(aliceClient);

  // Add Bob as member
  testDb.insert(schema.serverMembers).values({
    id: randomBytes(16).toString('hex'),
    serverId,
    userId: testUserId2,
    joinedAt: new Date(),
  }).run();

  // Both connect to channel
  const aliceConnect = await aliceClient.connect(
    'chat',
    { serverId, channelId },
    { username: 'alice' }
  );
  expect(aliceConnect.success).toBe(true);

  const bobConnect = await bobClient.connect(
    'chat',
    { serverId, channelId },
    { username: 'bob' }
  );
  expect(bobConnect.success).toBe(true);

  // Collect messages
  const aliceMessages: any[] = [];
  const bobMessages: any[] = [];

  // Both subscribe
  await aliceClient.subscribe(
    'chat',
    { serverId, channelId },
    aliceConnect.token,
    (msg) => aliceMessages.push(msg)
  );

  await bobClient.subscribe(
    'chat',
    { serverId, channelId },
    bobConnect.token,
    (msg) => bobMessages.push(msg)
  );

  // Alice sends a message
  await aliceClient.send(
    'chat',
    { serverId, channelId },
    aliceConnect.token,
    { content: 'Hello from Alice!' }
  );

  // Wait for broadcast
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Both should receive Alice's message
  expect(aliceMessages).toHaveLength(1);
  expect(aliceMessages[0].content).toBe('Hello from Alice!');
  expect(aliceMessages[0].username).toBe('alice');

  expect(bobMessages).toHaveLength(1);
  expect(bobMessages[0].content).toBe('Hello from Alice!');
  expect(bobMessages[0].username).toBe('alice');

  // Bob sends a message
  await bobClient.send(
    'chat',
    { serverId, channelId },
    bobConnect.token,
    { content: 'Hello from Bob!' }
  );

  // Wait for broadcast
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Both should receive Bob's message
  expect(aliceMessages).toHaveLength(2);
  expect(aliceMessages[1].content).toBe('Hello from Bob!');
  expect(aliceMessages[1].username).toBe('bob');

  expect(bobMessages).toHaveLength(2);
  expect(bobMessages[1].content).toBe('Hello from Bob!');
  expect(bobMessages[1].username).toBe('bob');
});

test('message persistence - messages saved to database', async () => {
  const client = await createAuthClient('alice');
  const { serverId, channelId } = await setupServerAndChannel(client);

  // Connect and send messages
  const connectResult = await client.connect(
    'chat',
    { serverId, channelId },
    { username: 'alice' }
  );
  expect(connectResult.success).toBe(true);

  await client.subscribe('chat', { serverId, channelId }, connectResult.token, () => {});

  await client.send('chat', { serverId, channelId }, connectResult.token, {
    content: 'Message 1',
  });
  await client.send('chat', { serverId, channelId }, connectResult.token, {
    content: 'Message 2',
  });

  // Wait for messages to be saved
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Fetch message history
  const messagesResult = await client.query('getMessages', { channelId });

  expect(messagesResult.success).toBe(true);
  expect(messagesResult.data).toHaveLength(2);
  expect(messagesResult.data[0].content).toBe('Message 1');
  expect(messagesResult.data[1].content).toBe('Message 2');
});

test('channel scoping - messages only go to correct channel', async () => {
  const client = await createAuthClient('alice');
  const { serverId } = await setupServerAndChannel(client);

  // Create two channels
  const channel1Result = await client.mutate('createChannel', {
    serverId,
    name: 'channel1',
  });
  const channel1Id = channel1Result.data.id;

  const channel2Result = await client.mutate('createChannel', {
    serverId,
    name: 'channel2',
  });
  const channel2Id = channel2Result.data.id;

  // Connect to both channels
  const connect1 = await client.connect('chat', { serverId, channelId: channel1Id }, { username: 'alice' });
  const connect2 = await client.connect('chat', { serverId, channelId: channel2Id }, { username: 'alice' });

  expect(connect1.success).toBe(true);
  expect(connect2.success).toBe(true);

  // Collect messages
  const channel1Messages: any[] = [];
  const channel2Messages: any[] = [];

  await client.subscribe('chat', { serverId, channelId: channel1Id }, connect1.token, (msg) =>
    channel1Messages.push(msg)
  );
  await client.subscribe('chat', { serverId, channelId: channel2Id }, connect2.token, (msg) =>
    channel2Messages.push(msg)
  );

  // Send message to channel 1
  await client.send('chat', { serverId, channelId: channel1Id }, connect1.token, {
    content: 'Message to channel 1',
  });

  // Wait for broadcast
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Only channel 1 should receive the message
  expect(channel1Messages).toHaveLength(1);
  expect(channel1Messages[0].content).toBe('Message to channel 1');

  expect(channel2Messages).toHaveLength(0);

  // Send message to channel 2
  await client.send('chat', { serverId, channelId: channel2Id }, connect2.token, {
    content: 'Message to channel 2',
  });

  // Wait for broadcast
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Only channel 2 should receive the new message
  expect(channel1Messages).toHaveLength(1); // Still 1
  expect(channel2Messages).toHaveLength(1);
  expect(channel2Messages[0].content).toBe('Message to channel 2');
});
