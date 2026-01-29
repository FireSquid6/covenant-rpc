import { CovenantServer } from '@covenant/server';
import { emptyServerToSidekick } from '@covenant/server/interfaces/empty';
import { appCovenant } from '../covenant';
import { db, initializeDatabase, createTestUser } from './db';
import {
  validateCredentials,
  createSession,
  validateToken,
  extractTokenFromHeader,
} from './auth';
import { eq } from 'drizzle-orm';
import { users } from '../../drizzle/schema';

// Initialize database on server startup
initializeDatabase();
createTestUser();

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
 * Create the Covenant server instance
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
   * Sidekick connection - we don't need channels for this simple example
   */
  sidekickConnection: emptyServerToSidekick(),
});

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
 * GetHello procedure - return personalized greeting for authenticated user
 */
server.defineProcedure('getHello', {
  resources: ({ ctx }) => {
    // This procedure reads the authenticated user's data
    // Note: resources function doesn't have access to derived, only ctx
    if (!ctx.user) {
      return [];
    }
    return [`user/${ctx.user.id}`];
  },
  procedure: ({ ctx, derived }) => {
    const user = derived.requireAuth();

    return {
      message: `Hello, ${user.username}! Welcome to Covenant RPC.`,
      username: user.username,
    };
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
