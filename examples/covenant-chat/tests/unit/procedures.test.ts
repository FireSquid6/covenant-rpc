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
 * Unit tests for all procedures
 *
 * These tests verify that each procedure works correctly in isolation
 * Tests: login, getServers, createServer, getChannels, createChannel, getMessages
 */

// Test database setup
let testDb: ReturnType<typeof drizzle>;
let testSqlite: Database;
let testSidekick: InternalSidekick;
let testServer: CovenantServer<typeof appCovenant, any, any>;
let testClient: CovenantClient<typeof appCovenant>;

// Test user IDs for convenience
const testUserId1 = 'test-user-1';
const testUserId2 = 'test-user-2';

beforeAll(() => {
  // Create in-memory database for testing
  testSqlite = new Database(':memory:');
  testDb = drizzle(testSqlite, { schema });

  // Initialize tables
  testSqlite.run(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  testSqlite.run(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  testSqlite.run(`
    CREATE TABLE servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  testSqlite.run(`
    CREATE TABLE server_members (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      joined_at INTEGER NOT NULL,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  testSqlite.run(`
    CREATE TABLE channels (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    )
  `);

  testSqlite.run(`
    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create test users
  testDb.insert(schema.users).values([
    {
      id: testUserId1,
      username: 'alice',
      password: 'password',
      createdAt: new Date(),
    },
    {
      id: testUserId2,
      username: 'bob',
      password: 'password',
      createdAt: new Date(),
    },
  ]).run();

  // Setup Sidekick
  testSidekick = new InternalSidekick();

  // Setup server with all procedure implementations
  testServer = new CovenantServer(appCovenant, {
    contextGenerator: async ({ request }) => {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader) {
        return { user: null };
      }

      const token = authHeader.replace('Bearer ', '');
      const session = await testDb.query.sessions.findFirst({
        where: eq(schema.sessions.token, token),
      });

      if (!session || session.expiresAt < new Date()) {
        return { user: null };
      }

      const user = await testDb.query.users.findFirst({
        where: eq(schema.users.id, session.userId),
      });

      if (!user) {
        return { user: null };
      }

      return {
        user: {
          id: user.id,
          username: user.username,
        },
      };
    },
    derivation: ({ ctx, error }) => ({
      requireAuth: () => {
        if (!ctx.user) {
          error('Unauthorized', 401);
        }
        return ctx.user;
      },
      db: testDb,
    }),
    sidekickConnection: testSidekick.getConnectionFromServer(),
  });

  // Set server callback
  testSidekick.setServerCallback((channelName, params, data, context) =>
    testServer.processChannelMessage(channelName, params, data, context)
  );

  // Define login procedure
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
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await testDb.insert(schema.sessions).values({
        id: sessionId,
        userId: user.id,
        token,
        createdAt: new Date(),
        expiresAt,
      });

      return {
        token,
        userId: user.id,
        username: user.username,
      };
    },
  });

  // Define getServers procedure
  testServer.defineProcedure('getServers', {
    resources: ({ ctx }) => {
      if (!ctx.user) return [];
      return [`servers/user/${ctx.user.id}`];
    },
    procedure: async ({ derived }) => {
      const user = derived.requireAuth();
      const memberships = await derived.db.query.serverMembers.findMany({
        where: eq(schema.serverMembers.userId, user.id),
        with: {
          server: true,
        },
      });

      return memberships.map((m: any) => ({
        id: m.server.id,
        name: m.server.name,
        ownerId: m.server.ownerId,
        createdAt: m.server.createdAt,
      }));
    },
  });

  // Define createServer procedure
  testServer.defineProcedure('createServer', {
    resources: ({ ctx, outputs }) => {
      if (!ctx.user) return [];
      return [`servers/user/${ctx.user.id}`, `server/${outputs.id}`];
    },
    procedure: async ({ inputs, derived }) => {
      const user = derived.requireAuth();
      const serverId = randomBytes(16).toString('hex');
      const now = new Date();

      const newServer = {
        id: serverId,
        name: inputs.name,
        ownerId: user.id,
        createdAt: now,
      };

      await derived.db.insert(schema.servers).values(newServer);

      // Add creator as member
      const memberId = randomBytes(16).toString('hex');
      await derived.db.insert(schema.serverMembers).values({
        id: memberId,
        serverId: serverId,
        userId: user.id,
        joinedAt: now,
      });

      return newServer;
    },
  });

  // Define getChannels procedure
  testServer.defineProcedure('getChannels', {
    resources: ({ inputs }) => {
      return [`channels/server/${inputs.serverId}`];
    },
    procedure: async ({ inputs, derived, error }) => {
      const user = derived.requireAuth();

      const membership = await derived.db.query.serverMembers.findFirst({
        where: and(
          eq(schema.serverMembers.serverId, inputs.serverId),
          eq(schema.serverMembers.userId, user.id)
        ),
      });

      if (!membership) {
        error('Unauthorized - you are not a member of this server', 403);
      }

      const serverChannels = await derived.db.query.channels.findMany({
        where: eq(schema.channels.serverId, inputs.serverId),
        orderBy: (channels, { asc }) => [asc(channels.createdAt)],
      });

      return serverChannels;
    },
  });

  // Define createChannel procedure
  testServer.defineProcedure('createChannel', {
    resources: ({ inputs, outputs }) => {
      return [`channels/server/${inputs.serverId}`, `channel/${outputs.id}`];
    },
    procedure: async ({ inputs, derived, error }) => {
      const user = derived.requireAuth();

      const membership = await derived.db.query.serverMembers.findFirst({
        where: and(
          eq(schema.serverMembers.serverId, inputs.serverId),
          eq(schema.serverMembers.userId, user.id)
        ),
      });

      if (!membership) {
        error('Unauthorized - you are not a member of this server', 403);
      }

      const channelId = randomBytes(16).toString('hex');
      const now = new Date();

      const newChannel = {
        id: channelId,
        serverId: inputs.serverId,
        name: inputs.name,
        createdAt: now,
      };

      await derived.db.insert(schema.channels).values(newChannel);

      return newChannel;
    },
  });

  // Define getMessages procedure
  testServer.defineProcedure('getMessages', {
    resources: ({ inputs }) => {
      return [`messages/channel/${inputs.channelId}`];
    },
    procedure: async ({ inputs, derived, error }) => {
      const user = derived.requireAuth();

      const channel = await derived.db.query.channels.findFirst({
        where: eq(schema.channels.id, inputs.channelId),
      });

      if (!channel) {
        error('Channel not found', 404);
      }

      const membership = await derived.db.query.serverMembers.findFirst({
        where: and(
          eq(schema.serverMembers.serverId, channel.serverId),
          eq(schema.serverMembers.userId, user.id)
        ),
      });

      if (!membership) {
        error('Unauthorized - you are not a member of this server', 403);
      }

      const channelMessages = await derived.db.query.messages.findMany({
        where: eq(schema.messages.channelId, inputs.channelId),
        orderBy: (messages, { desc }) => [desc(messages.createdAt)],
        limit: inputs.limit || 50,
        with: {
          user: true,
        },
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

  // Channel definition (we'll test this in channels.test.ts)
  testServer.defineChannel('chat', {
    onConnect: async () => ({ userId: '', username: '' }),
    onMessage: async () => {},
  });

  testServer.assertAllDefined();

  // Setup client
  testClient = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {}),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });
});

afterAll(() => {
  testSqlite.close();
});

// Helper function to create authenticated client
async function createAuthClient(username: string, password: string) {
  const loginResult = await testClient.mutate('login', { username, password });
  if (!loginResult.success) {
    throw new Error('Login failed');
  }

  return new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {
      Authorization: `Bearer ${loginResult.data.token}`,
    }),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });
}

/**
 * Login Procedure Tests
 */
test('login - success', async () => {
  const result = await testClient.mutate('login', {
    username: 'alice',
    password: 'password',
  });

  expect(result.success).toBe(true);
  expect(result.data.username).toBe('alice');
  expect(result.data.token).toBeTruthy();
  expect(result.resources).toEqual([]);
});

test('login - invalid credentials', async () => {
  const result = await testClient.mutate('login', {
    username: 'alice',
    password: 'wrongpassword',
  });

  expect(result.success).toBe(false);
  expect(result.error?.code).toBe(401);
});

/**
 * Server Management Tests
 */
test('getServers - requires auth', async () => {
  const result = await testClient.query('getServers', null);

  expect(result.success).toBe(false);
  expect(result.error?.code).toBe(401);
});

test('getServers - returns empty array initially', async () => {
  const client = await createAuthClient('alice', 'password');
  const result = await client.query('getServers', null);

  expect(result.success).toBe(true);
  expect(result.data).toEqual([]);
  expect(result.resources).toContain(`servers/user/${testUserId1}`);
});

test('createServer - success', async () => {
  const client = await createAuthClient('alice', 'password');
  const result = await client.mutate('createServer', {
    name: 'Test Server',
  });

  expect(result.success).toBe(true);
  expect(result.data.name).toBe('Test Server');
  expect(result.data.ownerId).toBe(testUserId1);
  expect(result.resources).toContain(`servers/user/${testUserId1}`);
  expect(result.resources).toContain(`server/${result.data.id}`);

  // Verify creator is automatically added as member
  const serversResult = await client.query('getServers', null);
  expect(serversResult.success).toBe(true);
  expect(serversResult.data).toHaveLength(1);
  expect(serversResult.data[0].name).toBe('Test Server');
});

test('createServer - requires auth', async () => {
  const result = await testClient.mutate('createServer', {
    name: 'Test Server',
  });

  expect(result.success).toBe(false);
  expect(result.error?.code).toBe(401);
});

/**
 * Channel Management Tests
 */
test('getChannels - requires server membership', async () => {
  const aliceClient = await createAuthClient('alice', 'password');
  const bobClient = await createAuthClient('bob', 'password');

  // Alice creates a server
  const serverResult = await aliceClient.mutate('createServer', {
    name: 'Alices Server',
  });
  expect(serverResult.success).toBe(true);
  const serverId = serverResult.data.id;

  // Bob tries to get channels (should fail - not a member)
  const result = await bobClient.query('getChannels', { serverId });

  expect(result.success).toBe(false);
  expect(result.error?.code).toBe(403);
});

test('getChannels - returns empty array initially', async () => {
  const client = await createAuthClient('alice', 'password');

  // Create a server
  const serverResult = await client.mutate('createServer', {
    name: 'Server for Channels',
  });
  expect(serverResult.success).toBe(true);
  const serverId = serverResult.data.id;

  // Get channels (should be empty)
  const result = await client.query('getChannels', { serverId });

  expect(result.success).toBe(true);
  expect(result.data).toEqual([]);
  expect(result.resources).toContain(`channels/server/${serverId}`);
});

test('createChannel - success', async () => {
  const client = await createAuthClient('alice', 'password');

  // Create a server
  const serverResult = await client.mutate('createServer', {
    name: 'Server with Channel',
  });
  expect(serverResult.success).toBe(true);
  const serverId = serverResult.data.id;

  // Create a channel
  const result = await client.mutate('createChannel', {
    serverId,
    name: 'general',
  });

  expect(result.success).toBe(true);
  expect(result.data.name).toBe('general');
  expect(result.data.serverId).toBe(serverId);
  expect(result.resources).toContain(`channels/server/${serverId}`);
  expect(result.resources).toContain(`channel/${result.data.id}`);

  // Verify channel was created
  const channelsResult = await client.query('getChannels', { serverId });
  expect(channelsResult.success).toBe(true);
  expect(channelsResult.data).toHaveLength(1);
  expect(channelsResult.data[0].name).toBe('general');
});

test('createChannel - requires server membership', async () => {
  const aliceClient = await createAuthClient('alice', 'password');
  const bobClient = await createAuthClient('bob', 'password');

  // Alice creates a server
  const serverResult = await aliceClient.mutate('createServer', {
    name: 'Alices Server 2',
  });
  expect(serverResult.success).toBe(true);
  const serverId = serverResult.data.id;

  // Bob tries to create a channel (should fail - not a member)
  const result = await bobClient.mutate('createChannel', {
    serverId,
    name: 'general',
  });

  expect(result.success).toBe(false);
  expect(result.error?.code).toBe(403);
});

/**
 * Message History Tests
 */
test('getMessages - returns empty array initially', async () => {
  const client = await createAuthClient('alice', 'password');

  // Create server and channel
  const serverResult = await client.mutate('createServer', {
    name: 'Server for Messages',
  });
  expect(serverResult.success).toBe(true);
  const serverId = serverResult.data.id;

  const channelResult = await client.mutate('createChannel', {
    serverId,
    name: 'general',
  });
  expect(channelResult.success).toBe(true);
  const channelId = channelResult.data.id;

  // Get messages (should be empty)
  const result = await client.query('getMessages', { channelId });

  expect(result.success).toBe(true);
  expect(result.data).toEqual([]);
  expect(result.resources).toContain(`messages/channel/${channelId}`);
});

test('getMessages - requires server membership', async () => {
  const aliceClient = await createAuthClient('alice', 'password');
  const bobClient = await createAuthClient('bob', 'password');

  // Alice creates server and channel
  const serverResult = await aliceClient.mutate('createServer', {
    name: 'Alices Server 3',
  });
  expect(serverResult.success).toBe(true);
  const serverId = serverResult.data.id;

  const channelResult = await aliceClient.mutate('createChannel', {
    serverId,
    name: 'general',
  });
  expect(channelResult.success).toBe(true);
  const channelId = channelResult.data.id;

  // Bob tries to get messages (should fail - not a member)
  const result = await bobClient.query('getMessages', { channelId });

  expect(result.success).toBe(false);
  expect(result.error?.code).toBe(403);
});
