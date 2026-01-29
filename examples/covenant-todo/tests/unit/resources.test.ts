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
import { eq } from 'drizzle-orm';

/**
 * Resource tracking tests
 *
 * These tests verify that procedures return the correct resource identifiers
 * which is critical for automatic cache invalidation
 */

// Test database setup
let testDb: ReturnType<typeof drizzle>;
let testSqlite: Database;
let testSidekick: InternalSidekick;
let testServer: CovenantServer<typeof appCovenant, any, any>;
let testClient: CovenantClient<typeof appCovenant>;
let authToken: string;
let userId: string;

beforeAll(async () => {
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
    CREATE TABLE todos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create test user
  userId = 'resource-test-user';
  testDb.insert(schema.users).values({
    id: userId,
    username: 'resourceuser',
    password: 'password',
    createdAt: new Date(),
  }).run();

  // Setup Sidekick
  testSidekick = new InternalSidekick();

  // Setup server (same as procedures.test.ts)
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

  testSidekick.setServerCallback((channelName, params, data, context) =>
    testServer.processChannelMessage(channelName, params, data, context)
  );

  // Define procedures
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

  testServer.defineProcedure('getTodos', {
    resources: ({ ctx }) => {
      if (!ctx.user) return [];
      return [`todos/user/${ctx.user.id}`];
    },
    procedure: async ({ derived }) => {
      const user = derived.requireAuth();
      const userTodos = await derived.db.query.todos.findMany({
        where: eq(schema.todos.userId, user.id),
        orderBy: (todos, { desc }) => [desc(todos.createdAt)],
      });
      return userTodos;
    },
  });

  testServer.defineProcedure('createTodo', {
    resources: ({ ctx, outputs }) => {
      if (!ctx.user) return [];
      return [`todos/user/${ctx.user.id}`, `todo/${outputs.id}`];
    },
    procedure: async ({ inputs, derived }) => {
      const user = derived.requireAuth();
      const todoId = randomBytes(16).toString('hex');
      const now = new Date();

      const newTodo = {
        id: todoId,
        userId: user.id,
        title: inputs.title,
        completed: false,
        createdAt: now,
      };

      await derived.db.insert(schema.todos).values(newTodo);
      return newTodo;
    },
  });

  testServer.defineProcedure('updateTodo', {
    resources: ({ ctx, inputs }) => {
      if (!ctx.user) return [];
      return [`todos/user/${ctx.user.id}`, `todo/${inputs.id}`];
    },
    procedure: async ({ inputs, derived, error }) => {
      const user = derived.requireAuth();
      const todo = await derived.db.query.todos.findFirst({
        where: eq(schema.todos.id, inputs.id),
      });

      if (!todo) {
        error('Todo not found', 404);
      }

      if (todo.userId !== user.id) {
        error('Unauthorized', 403);
      }

      const updates: { title?: string; completed?: boolean } = {};
      if (inputs.title !== undefined) updates.title = inputs.title;
      if (inputs.completed !== undefined) updates.completed = inputs.completed;

      await derived.db
        .update(schema.todos)
        .set(updates)
        .where(eq(schema.todos.id, inputs.id));

      const updatedTodo = await derived.db.query.todos.findFirst({
        where: eq(schema.todos.id, inputs.id),
      });

      if (!updatedTodo) {
        error('Failed to fetch updated todo', 500);
      }

      return updatedTodo;
    },
  });

  testServer.defineProcedure('deleteTodo', {
    resources: ({ ctx, inputs }) => {
      if (!ctx.user) return [];
      return [`todos/user/${ctx.user.id}`, `todo/${inputs.id}`];
    },
    procedure: async ({ inputs, derived, error }) => {
      const user = derived.requireAuth();
      const todo = await derived.db.query.todos.findFirst({
        where: eq(schema.todos.id, inputs.id),
      });

      if (!todo) {
        error('Todo not found', 404);
      }

      if (todo.userId !== user.id) {
        error('Unauthorized', 403);
      }

      await derived.db.delete(schema.todos).where(eq(schema.todos.id, inputs.id));
      return { success: true };
    },
  });

  testServer.assertAllDefined();

  // Setup client
  testClient = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {}),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  // Login to get auth token
  const loginResult = await testClient.mutate('login', {
    username: 'resourceuser',
    password: 'password',
  });

  expect(loginResult.success).toBe(true);
  authToken = loginResult.data.token;
});

afterAll(() => {
  testSqlite.close();
});

test('login returns empty resources array', async () => {
  const result = await testClient.mutate('login', {
    username: 'resourceuser',
    password: 'password',
  });

  expect(result.success).toBe(true);
  expect(result.resources).toEqual([]);
});

test('getTodos returns user-specific resource', async () => {
  const authClient = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {
      Authorization: `Bearer ${authToken}`,
    }),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  const result = await authClient.query('getTodos', null);

  expect(result.success).toBe(true);
  expect(result.resources).toEqual([`todos/user/${userId}`]);
});

test('createTodo returns both collection and item resources', async () => {
  const authClient = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {
      Authorization: `Bearer ${authToken}`,
    }),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  const result = await authClient.mutate('createTodo', {
    title: 'Resource Test Todo',
  });

  expect(result.success).toBe(true);
  expect(result.resources).toHaveLength(2);
  expect(result.resources).toContain(`todos/user/${userId}`);
  expect(result.resources).toContain(`todo/${result.data.id}`);
});

test('updateTodo returns both collection and item resources', async () => {
  const authClient = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {
      Authorization: `Bearer ${authToken}`,
    }),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  // Create a todo first
  const createResult = await authClient.mutate('createTodo', {
    title: 'Todo for Update Resource Test',
  });

  expect(createResult.success).toBe(true);
  const todoId = createResult.data.id;

  // Update it
  const updateResult = await authClient.mutate('updateTodo', {
    id: todoId,
    completed: true,
  });

  expect(updateResult.success).toBe(true);
  expect(updateResult.resources).toHaveLength(2);
  expect(updateResult.resources).toContain(`todos/user/${userId}`);
  expect(updateResult.resources).toContain(`todo/${todoId}`);
});

test('deleteTodo returns both collection and item resources', async () => {
  const authClient = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {
      Authorization: `Bearer ${authToken}`,
    }),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  // Create a todo first
  const createResult = await authClient.mutate('createTodo', {
    title: 'Todo for Delete Resource Test',
  });

  expect(createResult.success).toBe(true);
  const todoId = createResult.data.id;

  // Delete it
  const deleteResult = await authClient.mutate('deleteTodo', {
    id: todoId,
  });

  expect(deleteResult.success).toBe(true);
  expect(deleteResult.resources).toHaveLength(2);
  expect(deleteResult.resources).toContain(`todos/user/${userId}`);
  expect(deleteResult.resources).toContain(`todo/${todoId}`);
});

test('resource naming consistency', async () => {
  const authClient = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {
      Authorization: `Bearer ${authToken}`,
    }),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  // Get todos
  const getTodosResult = await authClient.query('getTodos', null);
  expect(getTodosResult.success).toBe(true);
  const collectionResource = `todos/user/${userId}`;

  // Create todo
  const createResult = await authClient.mutate('createTodo', {
    title: 'Consistency Test',
  });
  expect(createResult.success).toBe(true);
  const todoId = createResult.data.id;

  // Verify all mutations return the same collection resource
  expect(createResult.resources).toContain(collectionResource);

  const updateResult = await authClient.mutate('updateTodo', {
    id: todoId,
    completed: true,
  });
  expect(updateResult.success).toBe(true);
  expect(updateResult.resources).toContain(collectionResource);

  const deleteResult = await authClient.mutate('deleteTodo', {
    id: todoId,
  });
  expect(deleteResult.success).toBe(true);
  expect(deleteResult.resources).toContain(collectionResource);

  // Verify all operations return the same item resource
  expect(createResult.resources).toContain(`todo/${todoId}`);
  expect(updateResult.resources).toContain(`todo/${todoId}`);
  expect(deleteResult.resources).toContain(`todo/${todoId}`);
});
