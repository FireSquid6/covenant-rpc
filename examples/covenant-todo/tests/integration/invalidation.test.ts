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
 * Integration tests for automatic cache invalidation
 *
 * These tests verify the core value proposition of Covenant:
 * When a mutation runs, queries listening to the same resources automatically refetch
 */

// Test database setup
let testDb: ReturnType<typeof drizzle>;
let testSqlite: Database;
let testSidekick: InternalSidekick;
let testServer: CovenantServer<typeof appCovenant, any, any>;
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
  userId = 'invalidation-test-user';
  testDb.insert(schema.users).values({
    id: userId,
    username: 'invalidationuser',
    password: 'password',
    createdAt: new Date(),
  }).run();

  // Setup Sidekick
  testSidekick = new InternalSidekick();

  // Setup server
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

  // Login to get auth token
  const testClient = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {}),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  const loginResult = await testClient.mutate('login', {
    username: 'invalidationuser',
    password: 'password',
  });

  expect(loginResult.success).toBe(true);
  authToken = loginResult.data.token;
});

afterAll(() => {
  testSqlite.close();
});

test('createTodo mutation triggers getTodos refetch', async () => {
  const client = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {
      Authorization: `Bearer ${authToken}`,
    }),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  const results: any[] = [];

  // Listen to getTodos - this will automatically refetch when resources change
  const unsubscribe = client.listen('getTodos', null, (result) => {
    if (result.success) {
      results.push(result.data);
    }
  });

  // Wait for initial query
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(results).toHaveLength(1);
  const initialLength = results[0].length;

  // Create a new todo - this should trigger refetch
  await client.mutate('createTodo', { title: 'Invalidation Test Todo' });

  // Wait for refetch
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Verify that getTodos was automatically refetched
  expect(results.length).toBeGreaterThan(1);
  expect(results[results.length - 1].length).toBe(initialLength + 1);

  unsubscribe();
});

test('updateTodo mutation triggers getTodos refetch', async () => {
  const client = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {
      Authorization: `Bearer ${authToken}`,
    }),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  // Create a todo first
  const createResult = await client.mutate('createTodo', {
    title: 'Todo for Update Test',
  });
  expect(createResult.success).toBe(true);
  const todoId = createResult.data.id;

  const results: any[] = [];

  // Listen to getTodos
  const unsubscribe = client.listen('getTodos', null, (result) => {
    if (result.success) {
      results.push(result.data);
    }
  });

  // Wait for initial query
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(results).toHaveLength(1);
  const initialTodo = results[0].find((t: any) => t.id === todoId);
  expect(initialTodo.completed).toBe(false);

  // Update the todo - this should trigger refetch
  await client.mutate('updateTodo', {
    id: todoId,
    completed: true,
  });

  // Wait for refetch
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Verify that getTodos was automatically refetched with updated data
  expect(results.length).toBeGreaterThan(1);
  const updatedTodo = results[results.length - 1].find((t: any) => t.id === todoId);
  expect(updatedTodo.completed).toBe(true);

  unsubscribe();
});

test('deleteTodo mutation triggers getTodos refetch', async () => {
  const client = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {
      Authorization: `Bearer ${authToken}`,
    }),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  // Create a todo first
  const createResult = await client.mutate('createTodo', {
    title: 'Todo for Delete Test',
  });
  expect(createResult.success).toBe(true);
  const todoId = createResult.data.id;

  const results: any[] = [];

  // Listen to getTodos
  const unsubscribe = client.listen('getTodos', null, (result) => {
    if (result.success) {
      results.push(result.data);
    }
  });

  // Wait for initial query
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(results).toHaveLength(1);
  expect(results[0].find((t: any) => t.id === todoId)).toBeDefined();

  // Delete the todo - this should trigger refetch
  await client.mutate('deleteTodo', { id: todoId });

  // Wait for refetch
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Verify that getTodos was automatically refetched without the deleted todo
  expect(results.length).toBeGreaterThan(1);
  expect(results[results.length - 1].find((t: any) => t.id === todoId)).toBeUndefined();

  unsubscribe();
});

test('multiple mutations trigger multiple refetches', async () => {
  const client = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {
      Authorization: `Bearer ${authToken}`,
    }),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  const results: any[] = [];

  // Listen to getTodos
  const unsubscribe = client.listen('getTodos', null, (result) => {
    if (result.success) {
      results.push(result.data);
    }
  });

  // Wait for initial query
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(results).toHaveLength(1);
  const initialLength = results[0].length;

  // Perform multiple mutations
  await client.mutate('createTodo', { title: 'Multi 1' });
  await new Promise((resolve) => setTimeout(resolve, 50));

  await client.mutate('createTodo', { title: 'Multi 2' });
  await new Promise((resolve) => setTimeout(resolve, 50));

  await client.mutate('createTodo', { title: 'Multi 3' });
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Verify multiple refetches occurred
  expect(results.length).toBeGreaterThan(3);
  expect(results[results.length - 1].length).toBe(initialLength + 3);

  unsubscribe();
});

test('listen with remote option', async () => {
  const client = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {
      Authorization: `Bearer ${authToken}`,
    }),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  const results: any[] = [];

  // Listen with remote: true (for cross-client invalidation)
  const unsubscribe = client.listen(
    'getTodos',
    null,
    (result) => {
      if (result.success) {
        results.push(result.data);
      }
    },
    { remote: true }
  );

  // Wait for initial query
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(results).toHaveLength(1);

  // Create a todo
  await client.mutate('createTodo', { title: 'Remote Test' });

  // Wait for refetch
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Should still work with remote: true
  expect(results.length).toBeGreaterThan(1);

  unsubscribe();
});
