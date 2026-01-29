import { CovenantServer } from '@covenant/server';
import { InternalSidekick } from '@covenant/sidekick/internal';
import { appCovenant } from '../covenant';
import { db, initializeDatabase, createTestUser } from './db';
import {
  validateCredentials,
  createSession,
  validateToken,
  extractTokenFromHeader,
} from './auth';
import { eq } from 'drizzle-orm';
import { todos } from '../../drizzle/schema';
import { randomBytes } from 'crypto';

// Initialize database on server startup
initializeDatabase();
createTestUser();

/**
 * Initialize InternalSidekick for resource tracking and cache invalidation
 * This enables automatic refetch when mutations update data
 */
export const sidekick = new InternalSidekick();

/**
 * Context type - contains authenticated user info (or null if not authenticated)
 */
type Context = {
  user: {
    id: string;
    username: string;
  } | null;
};

/**
 * Derivation type - utility functions available to all procedures
 */
type Derivation = {
  /**
   * Require that the user is authenticated, throw error if not
   */
  requireAuth: () => { id: string; username: string };
  /**
   * Database access
   */
  db: typeof db;
};

/**
 * Create the Covenant server instance with Sidekick connection
 */
export const server = new CovenantServer(appCovenant, {
  /**
   * Context generator - runs once per request to extract auth info
   */
  contextGenerator: async ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return { user: null };
    }

    const user = await validateToken(token);
    return { user };
  },

  /**
   * Derivation - utility functions available to all procedures
   */
  derivation: ({ ctx, error }) => ({
    requireAuth: () => {
      if (!ctx.user) {
        error('Unauthorized - please log in', 401);
      }
      return ctx.user;
    },
    db,
  }),

  /**
   * Sidekick connection for resource tracking
   * This enables cross-client cache invalidation
   */
  sidekickConnection: sidekick.getConnectionFromServer(),
});

/**
 * Set the server callback for Sidekick
 * This allows Sidekick to forward channel messages to the server
 */
sidekick.setServerCallback((channelName, params, data, context) =>
  server.processChannelMessage(channelName, params, data, context)
);

/**
 * Login procedure - authenticate user and return session token
 */
server.defineProcedure('login', {
  resources: () => {
    // Login doesn't touch any cacheable resources
    return [];
  },
  procedure: async ({ inputs, error }) => {
    // Validate credentials
    const user = await validateCredentials(inputs.username, inputs.password);

    if (!user) {
      error('Invalid username or password', 401);
    }

    // Create session
    const token = await createSession(user.id);

    return {
      token,
      userId: user.id,
      username: user.username,
    };
  },
});

/**
 * Get all todos for the authenticated user
 * Resource: todos/user/${userId}
 */
server.defineProcedure('getTodos', {
  resources: ({ ctx }) => {
    // This query reads todos for the authenticated user
    if (!ctx.user) {
      return [];
    }
    return [`todos/user/${ctx.user.id}`];
  },
  procedure: async ({ derived }) => {
    const user = derived.requireAuth();

    // Fetch all todos for this user
    const userTodos = await derived.db.query.todos.findMany({
      where: eq(todos.userId, user.id),
      orderBy: (todos, { desc }) => [desc(todos.createdAt)],
    });

    return userTodos;
  },
});

/**
 * Create a new todo
 * Resources: todos/user/${userId}, todo/${todoId}
 */
server.defineProcedure('createTodo', {
  resources: ({ ctx, outputs }) => {
    // This mutation affects:
    // 1. The user's todo list (todos/user/${userId})
    // 2. The specific todo item (todo/${id})
    if (!ctx.user) {
      return [];
    }
    return [`todos/user/${ctx.user.id}`, `todo/${outputs.id}`];
  },
  procedure: async ({ inputs, derived }) => {
    const user = derived.requireAuth();

    // Create new todo
    const todoId = randomBytes(16).toString('hex');
    const now = new Date();

    const newTodo = {
      id: todoId,
      userId: user.id,
      title: inputs.title,
      completed: false,
      createdAt: now,
    };

    await derived.db.insert(todos).values(newTodo);

    return newTodo;
  },
});

/**
 * Update a todo's title and/or completed status
 * Resources: todos/user/${userId}, todo/${todoId}
 */
server.defineProcedure('updateTodo', {
  resources: ({ ctx, inputs }) => {
    // This mutation affects:
    // 1. The user's todo list (todos/user/${userId})
    // 2. The specific todo item (todo/${id})
    if (!ctx.user) {
      return [];
    }
    return [`todos/user/${ctx.user.id}`, `todo/${inputs.id}`];
  },
  procedure: async ({ inputs, derived, error }) => {
    const user = derived.requireAuth();

    // Fetch the todo to verify ownership
    const todo = await derived.db.query.todos.findFirst({
      where: eq(todos.id, inputs.id),
    });

    if (!todo) {
      error('Todo not found', 404);
    }

    // Verify the user owns this todo
    if (todo.userId !== user.id) {
      error('Unauthorized - you can only update your own todos', 403);
    }

    // Build update object
    const updates: { title?: string; completed?: boolean } = {};
    if (inputs.title !== undefined) {
      updates.title = inputs.title;
    }
    if (inputs.completed !== undefined) {
      updates.completed = inputs.completed;
    }

    // Update the todo
    await derived.db
      .update(todos)
      .set(updates)
      .where(eq(todos.id, inputs.id));

    // Fetch and return the updated todo
    const updatedTodo = await derived.db.query.todos.findFirst({
      where: eq(todos.id, inputs.id),
    });

    if (!updatedTodo) {
      error('Failed to fetch updated todo', 500);
    }

    return updatedTodo;
  },
});

/**
 * Delete a todo
 * Resources: todos/user/${userId}, todo/${todoId}
 */
server.defineProcedure('deleteTodo', {
  resources: ({ ctx, inputs }) => {
    // This mutation affects:
    // 1. The user's todo list (todos/user/${userId})
    // 2. The specific todo item (todo/${id})
    if (!ctx.user) {
      return [];
    }
    return [`todos/user/${ctx.user.id}`, `todo/${inputs.id}`];
  },
  procedure: async ({ inputs, derived, error }) => {
    const user = derived.requireAuth();

    // Fetch the todo to verify ownership
    const todo = await derived.db.query.todos.findFirst({
      where: eq(todos.id, inputs.id),
    });

    if (!todo) {
      error('Todo not found', 404);
    }

    // Verify the user owns this todo
    if (todo.userId !== user.id) {
      error('Unauthorized - you can only delete your own todos', 403);
    }

    // Delete the todo
    await derived.db.delete(todos).where(eq(todos.id, inputs.id));

    return { success: true };
  },
});

/**
 * IMPORTANT: Verify that all procedures defined in the covenant are implemented
 * This will throw an error at startup if any procedures are missing
 */
server.assertAllDefined();

/**
 * HTTP handler for Next.js API routes or other frameworks
 */
export async function handleRequest(request: Request): Promise<Response> {
  return server.handle(request);
}
