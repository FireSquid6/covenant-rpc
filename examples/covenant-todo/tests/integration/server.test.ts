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
 * Integration tests for the full server implementation
 *
 * These tests verify that the complete CRUD flow works correctly
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

  // Create test users
  userId = 'server-test-user-1';
  testDb.insert(schema.users).values({
    id: userId,
    username: 'serveruser',
    password: 'password',
    createdAt: new Date(),
  }).run();

  testDb.insert(schema.users).values({
    id: 'server-test-user-2',
    username: 'otheruser',
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
    username: 'serveruser',
    password: 'password',
  });

  expect(loginResult.success).toBe(true);
  authToken = loginResult.data.token;
});

afterAll(() => {
  testSqlite.close();
});

test('full CRUD flow', async () => {
  const client = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {
      Authorization: `Bearer ${authToken}`,
    }),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  // 1. Get initial todos (should be empty)
  let getTodosResult = await client.query('getTodos', null);
  expect(getTodosResult.success).toBe(true);
  expect(getTodosResult.data).toEqual([]);

  // 2. Create a todo
  const createResult = await client.mutate('createTodo', {
    title: 'CRUD Test Todo',
  });
  expect(createResult.success).toBe(true);
  expect(createResult.data.title).toBe('CRUD Test Todo');
  expect(createResult.data.completed).toBe(false);
  const todoId = createResult.data.id;

  // 3. Read todos (should have one)
  getTodosResult = await client.query('getTodos', null);
  expect(getTodosResult.success).toBe(true);
  expect(getTodosResult.data).toHaveLength(1);
  expect(getTodosResult.data[0].id).toBe(todoId);

  // 4. Update the todo
  const updateResult = await client.mutate('updateTodo', {
    id: todoId,
    title: 'Updated CRUD Test Todo',
    completed: true,
  });
  expect(updateResult.success).toBe(true);
  expect(updateResult.data.title).toBe('Updated CRUD Test Todo');
  expect(updateResult.data.completed).toBe(true);

  // 5. Read todos (should have updated data)
  getTodosResult = await client.query('getTodos', null);
  expect(getTodosResult.success).toBe(true);
  expect(getTodosResult.data[0].title).toBe('Updated CRUD Test Todo');
  expect(getTodosResult.data[0].completed).toBe(true);

  // 6. Delete the todo
  const deleteResult = await client.mutate('deleteTodo', { id: todoId });
  expect(deleteResult.success).toBe(true);
  expect(deleteResult.data.success).toBe(true);

  // 7. Read todos (should be empty again)
  getTodosResult = await client.query('getTodos', null);
  expect(getTodosResult.success).toBe(true);
  expect(getTodosResult.data).toEqual([]);
});

test('multiple users dont see each others todos', async () => {
  // Login as first user
  const testClient = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {}),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  const login1 = await testClient.mutate('login', {
    username: 'serveruser',
    password: 'password',
  });
  expect(login1.success).toBe(true);

  const client1 = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {
      Authorization: `Bearer ${login1.data.token}`,
    }),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  // Login as second user
  const login2 = await testClient.mutate('login', {
    username: 'otheruser',
    password: 'password',
  });
  expect(login2.success).toBe(true);

  const client2 = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {
      Authorization: `Bearer ${login2.data.token}`,
    }),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  // User 1 creates a todo
  const createResult = await client1.mutate('createTodo', {
    title: 'User 1 Todo',
  });
  expect(createResult.success).toBe(true);

  // User 2 creates a todo
  const createResult2 = await client2.mutate('createTodo', {
    title: 'User 2 Todo',
  });
  expect(createResult2.success).toBe(true);

  // User 1 should only see their own todo
  const todos1 = await client1.query('getTodos', null);
  expect(todos1.success).toBe(true);
  expect(todos1.data.some((t) => t.title === 'User 1 Todo')).toBe(true);
  expect(todos1.data.some((t) => t.title === 'User 2 Todo')).toBe(false);

  // User 2 should only see their own todo
  const todos2 = await client2.query('getTodos', null);
  expect(todos2.success).toBe(true);
  expect(todos2.data.some((t) => t.title === 'User 2 Todo')).toBe(true);
  expect(todos2.data.some((t) => t.title === 'User 1 Todo')).toBe(false);
});

test('user cannot update another users todo', async () => {
  // Login as first user
  const testClient = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {}),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  const login1 = await testClient.mutate('login', {
    username: 'serveruser',
    password: 'password',
  });
  expect(login1.success).toBe(true);

  const client1 = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {
      Authorization: `Bearer ${login1.data.token}`,
    }),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  // Login as second user
  const login2 = await testClient.mutate('login', {
    username: 'otheruser',
    password: 'password',
  });
  expect(login2.success).toBe(true);

  const client2 = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(testServer, {
      Authorization: `Bearer ${login2.data.token}`,
    }),
    sidekickConnection: testSidekick.getConnectionFromClient(),
  });

  // User 1 creates a todo
  const createResult = await client1.mutate('createTodo', {
    title: 'User 1 Private Todo',
  });
  expect(createResult.success).toBe(true);
  const todoId = createResult.data.id;

  // User 2 tries to update User 1's todo (should fail)
  const updateResult = await client2.mutate('updateTodo', {
    id: todoId,
    completed: true,
  });
  expect(updateResult.success).toBe(false);
  expect(updateResult.error?.code).toBe(403);
});
