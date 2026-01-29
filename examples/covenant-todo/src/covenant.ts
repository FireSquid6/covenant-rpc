import { z } from 'zod';
import { declareCovenant, query, mutation } from '@covenant/core';

/**
 * Covenant definition for the todo application.
 *
 * This file defines the API contract between the client and server.
 * IMPORTANT: Only import validation schemas (like Zod) - never import
 * implementation code, database connections, or business logic.
 */

/**
 * Zod schema for a todo item
 */
export const todoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  completed: z.boolean(),
  createdAt: z.date(),
});

export const appCovenant = declareCovenant({
  procedures: {
    /**
     * Login procedure - authenticates a user with username/password
     * Returns an auth token that should be used in subsequent requests
     */
    login: mutation({
      input: z.object({
        username: z.string(),
        password: z.string(),
      }),
      output: z.object({
        token: z.string(),
        userId: z.string(),
        username: z.string(),
      }),
    }),

    /**
     * Get all todos for the authenticated user
     * Resource: todos/user/${userId}
     */
    getTodos: query({
      input: z.null(),
      output: z.array(todoSchema),
    }),

    /**
     * Create a new todo
     * Resource: todos/user/${userId}, todo/${todoId}
     */
    createTodo: mutation({
      input: z.object({
        title: z.string().min(1),
      }),
      output: todoSchema,
    }),

    /**
     * Update a todo's title and/or completed status
     * Resource: todos/user/${userId}, todo/${todoId}
     */
    updateTodo: mutation({
      input: z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        completed: z.boolean().optional(),
      }),
      output: todoSchema,
    }),

    /**
     * Delete a todo
     * Resource: todos/user/${userId}, todo/${todoId}
     */
    deleteTodo: mutation({
      input: z.object({
        id: z.string(),
      }),
      output: z.object({
        success: z.boolean(),
      }),
    }),
  },

  // No realtime channels needed for this example
  channels: {},
});

// Export type for use in server and client
export type AppCovenant = typeof appCovenant;
