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
 * Unit tests for all procedures
 *
 * These tests verify that each procedure works correctly in isolation
 */

// Test database setup
let testDb: ReturnType<typeof drizzle>;
let testSqlite: Database;
let testSidekick: InternalSidekick;
let testServer: CovenantServer<typeof appCovenant, any, any>;
let testClient: CovenantClient<typeof appCovenant>;

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
  const userId = 'test-user-1';
  testDb.insert(schema.users).values({
    id: userId,
    username: 'testuser',
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

  // Set server callback
  testSidekick.setServerCallback((channelName, params, data, context) =>
    testServer.processChannelMessage(channelName, params, data, context)
  );

  // Define all procedures (similar to server.ts but with test db)
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
});

afterAll(() => {
  testSqlite.close();
});

test('login procedure - success', async () => {
  const result = await testClient.mutate('login', {
    username: 'testuser',
    password: 'password',
  });

  expect(result.success).toBe(true);
  expect(result.data.username).toBe('testuser');
  expect(result.data.token).toBeTruthy();
  expect(result.resources).toEqual([]);
});

test('login procedure - invalid credentials', async () => {
  const result = await testClient.mutate('login', {
    username: 'testuser',
    password: 'wrongpassword',
  });

  expect(result.success).toBe(false);
  expect(result.error?.code).toBe(401);
});

test('getTodos procedure - requires auth', async () => {
  const result = await testClient.query('getTodos', null);

  expect(result.success).toBe(false);
  expect(result.error?.code).toBe(401);
});

test('getTodos procedure - returns empty array initially', async () => {
  // Login first
  const loginResult = await testClient.mutate('login', {
    username: 'testuser',
    password: 'password',
  });

  expect(loginResult.success).toBe(true);
  const token = loginResult.data.token;

  // Create authenticated client
  const authClient = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {
      Authorization: `Bearer ${token}`,
    }),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  const result = await authClient.query('getTodos', null);

  expect(result.success).toBe(true);
  expect(result.data).toEqual([]);
  expect(result.resources).toContain('todos/user/test-user-1');
});

test('createTodo procedure - success', async () => {
  // Login first
  const loginResult = await testClient.mutate('login', {
    username: 'testuser',
    password: 'password',
  });

  expect(loginResult.success).toBe(true);
  const token = loginResult.data.token;

  // Create authenticated client
  const authClient = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {
      Authorization: `Bearer ${token}`,
    }),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  const result = await authClient.mutate('createTodo', {
    title: 'Test Todo',
  });

  expect(result.success).toBe(true);
  expect(result.data.title).toBe('Test Todo');
  expect(result.data.completed).toBe(false);
  expect(result.resources).toContain('todos/user/test-user-1');
  expect(result.resources).toContain(`todo/${result.data.id}`);
});

test('updateTodo procedure - success', async () => {
  // Login first
  const loginResult = await testClient.mutate('login', {
    username: 'testuser',
    password: 'password',
  });

  expect(loginResult.success).toBe(true);
  const token = loginResult.data.token;

  // Create authenticated client
  const authClient = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {
      Authorization: `Bearer ${token}`,
    }),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  // Create a todo first
  const createResult = await authClient.mutate('createTodo', {
    title: 'Todo to Update',
  });

  expect(createResult.success).toBe(true);
  const todoId = createResult.data.id;

  // Update the todo
  const updateResult = await authClient.mutate('updateTodo', {
    id: todoId,
    completed: true,
  });

  expect(updateResult.success).toBe(true);
  expect(updateResult.data.completed).toBe(true);
  expect(updateResult.data.title).toBe('Todo to Update');
  expect(updateResult.resources).toContain('todos/user/test-user-1');
  expect(updateResult.resources).toContain(`todo/${todoId}`);
});

test('deleteTodo procedure - success', async () => {
  // Login first
  const loginResult = await testClient.mutate('login', {
    username: 'testuser',
    password: 'password',
  });

  expect(loginResult.success).toBe(true);
  const token = loginResult.data.token;

  // Create authenticated client
  const authClient = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {
      Authorization: `Bearer ${token}`,
    }),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  // Create a todo first
  const createResult = await authClient.mutate('createTodo', {
    title: 'Todo to Delete',
  });

  expect(createResult.success).toBe(true);
  const todoId = createResult.data.id;

  // Delete the todo
  const deleteResult = await authClient.mutate('deleteTodo', {
    id: todoId,
  });

  expect(deleteResult.success).toBe(true);
  expect(deleteResult.data.success).toBe(true);
  expect(deleteResult.resources).toContain('todos/user/test-user-1');
  expect(deleteResult.resources).toContain(`todo/${todoId}`);

  // Verify it's deleted
  const getTodosResult = await authClient.query('getTodos', null);
  expect(getTodosResult.success).toBe(true);
  expect(getTodosResult.data.find((t) => t.id === todoId)).toBeUndefined();
});
