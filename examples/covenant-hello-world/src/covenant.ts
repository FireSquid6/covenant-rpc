import { z } from "zod";
import { declareCovenant, query, mutation } from "@covenant/core";

/**
 * Covenant definition for the hello world example.
 *
 * This file defines the API contract between the client and server.
 * IMPORTANT: Only import validation schemas (like Zod) - never import
 * implementation code, database connections, or business logic.
 */
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
     * GetHello procedure - returns a personalized greeting
     * Requires authentication (token in headers)
     */
    getHello: query({
      input: z.null(),
      output: z.object({
        message: z.string(),
        username: z.string(),
      }),
    }),
  },

  // No realtime channels needed for this simple example
  channels: {},
});

// Export type for use in server and client
export type AppCovenant = typeof appCovenant;
