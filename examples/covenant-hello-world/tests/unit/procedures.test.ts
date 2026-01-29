import { test, expect, beforeEach } from 'bun:test';
import { CovenantServer } from '@covenant/server';
import { CovenantClient } from '@covenant/client';
import { emptyServerToSidekick } from '@covenant/server/interfaces/empty';
import { emptyClientToSidekick } from '@covenant/client/interfaces/empty';
import { directClientToServer } from '@covenant/server/interfaces/direct';
import { appCovenant } from '../../src/covenant';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * Unit tests for Covenant procedures
 *
 * These tests use directClientToServer for fast in-memory testing
 * without HTTP overhead. They test individual procedures in isolation.
 */

// Create in-memory database for testing
function createTestDatabase() {
  const sqlite = new Database(':memory:');

  // Create tables
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  sqlite.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  const db = drizzle(sqlite, { schema });

  // Insert test user
  sqlite
    .prepare('INSERT INTO users (id, username, password, created_at) VALUES (?, ?, ?, ?)')
    .run('test-user-1', 'testuser', 'password123', Date.now());

  return { db, sqlite };
}

test('login procedure - valid credentials', async () => {
  const { db } = createTestDatabase();

  const server = new CovenantServer(appCovenant, {
    contextGenerator: () => ({ user: null }),
    derivation: () => ({
      requireAuth: () => {
        throw new Error('Not authenticated');
      },
      db,
    }),
    sidekickConnection: emptyServerToSidekick(),
  });

  // Define login procedure
  server.defineProcedure('login', {
    resources: () => [],
    procedure: async ({ inputs, error }) => {
      const user = await db.query.users.findFirst({
        where: eq(schema.users.username, inputs.username),
      });

      if (!user || user.password !== inputs.password) {
        error('Invalid username or password', 401);
      }

      // Create session
      const token = 'test-token-' + Math.random();
      await db.insert(schema.sessions).values({
        id: 'session-1',
        userId: user.id,
        token,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      return {
        token,
        userId: user.id,
        username: user.username,
      };
    },
  });

  // Define getHello (required by assertAllDefined)
  server.defineProcedure('getHello', {
    resources: () => [],
    procedure: () => ({ message: '', username: '' }),
  });

  server.assertAllDefined();

  const client = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(server, {}),
    sidekickConnection: emptyClientToSidekick(),
  });

  // Test valid credentials
  const result = await client.mutate('login', {
    username: 'testuser',
    password: 'password123',
  });

  expect(result.success).toBe(true);
  expect(result.error).toBe(null);
  if (result.success) {
    expect(result.data.userId).toBe('test-user-1');
    expect(result.data.username).toBe('testuser');
    expect(result.data.token).toContain('test-token-');
  }
});

test('login procedure - invalid credentials', async () => {
  const { db } = createTestDatabase();

  const server = new CovenantServer(appCovenant, {
    contextGenerator: () => ({ user: null }),
    derivation: () => ({
      requireAuth: () => {
        throw new Error('Not authenticated');
      },
      db,
    }),
    sidekickConnection: emptyServerToSidekick(),
  });

  server.defineProcedure('login', {
    resources: () => [],
    procedure: async ({ inputs, error }) => {
      const user = await db.query.users.findFirst({
        where: eq(schema.users.username, inputs.username),
      });

      if (!user || user.password !== inputs.password) {
        error('Invalid username or password', 401);
      }

      return {
        token: 'dummy',
        userId: user.id,
        username: user.username,
      };
    },
  });

  server.defineProcedure('getHello', {
    resources: () => [],
    procedure: () => ({ message: '', username: '' }),
  });

  server.assertAllDefined();

  const client = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(server, {}),
    sidekickConnection: emptyClientToSidekick(),
  });

  // Test wrong password
  const result = await client.mutate('login', {
    username: 'testuser',
    password: 'wrongpassword',
  });

  expect(result.success).toBe(false);
  expect(result.data).toBe(null);
  if (!result.success) {
    expect(result.error.code).toBe(401);
    expect(result.error.message).toBe('Invalid username or password');
  }
});

test('getHello procedure - authenticated user', async () => {
  const { db } = createTestDatabase();

  const server = new CovenantServer(appCovenant, {
    contextGenerator: () => ({
      user: {
        id: 'test-user-1',
        username: 'testuser',
      },
    }),
    derivation: ({ ctx, error }) => ({
      requireAuth: () => {
        if (!ctx.user) {
          error('Unauthorized', 401);
        }
        return ctx.user;
      },
      db,
    }),
    sidekickConnection: emptyServerToSidekick(),
  });

  server.defineProcedure('login', {
    resources: () => [],
    procedure: () => ({ token: '', userId: '', username: '' }),
  });

  server.defineProcedure('getHello', {
    resources: ({ ctx }) => {
      if (!ctx.user) {
        return [];
      }
      return [`user/${ctx.user.id}`];
    },
    procedure: ({ derived }) => {
      const user = derived.requireAuth();
      return {
        message: `Hello, ${user.username}! Welcome to Covenant RPC.`,
        username: user.username,
      };
    },
  });

  server.assertAllDefined();

  const client = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(server, {}),
    sidekickConnection: emptyClientToSidekick(),
  });

  const result = await client.query('getHello', null);

  expect(result.success).toBe(true);
  expect(result.error).toBe(null);
  if (result.success) {
    expect(result.data.message).toBe('Hello, testuser! Welcome to Covenant RPC.');
    expect(result.data.username).toBe('testuser');
    expect(result.resources).toEqual(['user/test-user-1']);
  }
});

test('getHello procedure - unauthenticated user', async () => {
  const { db } = createTestDatabase();

  const server = new CovenantServer(appCovenant, {
    contextGenerator: () => ({ user: null }),
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

  server.defineProcedure('login', {
    resources: () => [],
    procedure: () => ({ token: '', userId: '', username: '' }),
  });

  server.defineProcedure('getHello', {
    resources: ({ ctx }) => {
      if (!ctx.user) {
        return [];
      }
      return [`user/${ctx.user.id}`];
    },
    procedure: ({ derived }) => {
      const user = derived.requireAuth();
      return {
        message: `Hello, ${user.username}!`,
        username: user.username,
      };
    },
  });

  server.assertAllDefined();

  const client = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(server, {}),
    sidekickConnection: emptyClientToSidekick(),
  });

  const result = await client.query('getHello', null);

  expect(result.success).toBe(false);
  expect(result.data).toBe(null);
  if (!result.success) {
    expect(result.error.code).toBe(401);
    expect(result.error.message).toBe('Unauthorized - please log in');
  }
});
