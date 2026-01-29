import { CovenantServer } from '@covenant/server';
import { InternalSidekick } from '@covenant/sidekick/internal';
import { appCovenant } from '../covenant';
import { db, initializeDatabase, createTestData } from './db';
import {
  validateCredentials,
  createSession,
  validateToken,
  extractTokenFromHeader,
} from './auth';
import { eq, and } from 'drizzle-orm';
import { servers, serverMembers, channels, messages } from '../../drizzle/schema';
import { randomBytes } from 'crypto';

// Initialize database on server startup
initializeDatabase();
createTestData();

/**
 * Initialize InternalSidekick for realtime channels and resource tracking
 * This enables:
 * - Bidirectional WebSocket communication
 * - Automatic refetch when mutations update data
 * - Cross-client message broadcasting
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
 * Derivation type - utility functions available to all procedures and channels
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
   * Derivation - utility functions available to all procedures and channels
   */
  derivation: ({ ctx, error }) => ({
    requireAuth: () => {
      if (!ctx.user) {
        throw error('Unauthorized - please log in', 401);
      }
      return ctx.user;
    },
    db,
  }),

  /**
   * Sidekick connection for realtime channels and resource tracking
   * This enables cross-client cache invalidation and WebSocket communication
   */
  sidekickConnection: sidekick.getConnectionFromServer(),
});

/**
 * Set the server callback for Sidekick
 * This allows Sidekick to forward channel messages to the server
 * CRITICAL: Without this, channel messages won't be processed!
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
      throw error('Invalid username or password', 401);
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
 * Get all servers the authenticated user is a member of
 * Resource: servers/user/${userId}
 */
server.defineProcedure('getServers', {
  resources: ({ ctx }) => {
    if (!ctx.user) {
      return [];
    }
    return [`servers/user/${ctx.user.id}`];
  },
  procedure: async ({ derived }) => {
    const user = derived.requireAuth();

    // Get all server memberships for this user
    const memberships = await derived.db.query.serverMembers.findMany({
      where: eq(serverMembers.userId, user.id),
      with: {
        server: true,
      },
    });

    // Extract and return the servers
    return memberships.map((m: any) => ({
      id: m.server.id,
      name: m.server.name,
      ownerId: m.server.ownerId,
      createdAt: m.server.createdAt,
    }));
  },
});

/**
 * Create a new server
 * Automatically adds the creator as a member
 * Resources: servers/user/${userId}, server/${serverId}
 */
server.defineProcedure('createServer', {
  resources: ({ ctx, outputs }) => {
    if (!ctx.user) {
      return [];
    }
    return [`servers/user/${ctx.user.id}`, `server/${outputs.id}`];
  },
  procedure: async ({ inputs, derived }) => {
    const user = derived.requireAuth();

    // Create the server
    const serverId = randomBytes(16).toString('hex');
    const now = new Date();

    const newServer = {
      id: serverId,
      name: inputs.name,
      ownerId: user.id,
      createdAt: now,
    };

    await derived.db.insert(servers).values(newServer);

    // Automatically add creator as member
    const memberId = randomBytes(16).toString('hex');
    await derived.db.insert(serverMembers).values({
      id: memberId,
      serverId: serverId,
      userId: user.id,
      joinedAt: now,
    });

    return newServer;
  },
});

/**
 * Get all channels in a server
 * Requires user to be a member of the server
 * Resource: channels/server/${serverId}
 */
server.defineProcedure('getChannels', {
  resources: ({ inputs }) => {
    return [`channels/server/${inputs.serverId}`];
  },
  procedure: async ({ inputs, derived, error }) => {
    const user = derived.requireAuth();

    // Verify user is a member of this server
    const membership = await derived.db.query.serverMembers.findFirst({
      where: and(
        eq(serverMembers.serverId, inputs.serverId),
        eq(serverMembers.userId, user.id)
      ),
    });

    if (!membership) {
      error('Unauthorized - you are not a member of this server', 403);
    }

    // Get all channels in this server
    const serverChannels = await derived.db.query.channels.findMany({
      where: eq(channels.serverId, inputs.serverId),
      orderBy: (channels, { asc }) => [asc(channels.createdAt)],
    });

    return serverChannels;
  },
});

/**
 * Create a new channel in a server
 * Requires user to be a member of the server
 * Resources: channels/server/${serverId}, channel/${channelId}
 */
server.defineProcedure('createChannel', {
  resources: ({ inputs, outputs }) => {
    return [`channels/server/${inputs.serverId}`, `channel/${outputs.id}`];
  },
  procedure: async ({ inputs, derived, error }) => {
    const user = derived.requireAuth();

    // Verify user is a member of this server
    const membership = await derived.db.query.serverMembers.findFirst({
      where: and(
        eq(serverMembers.serverId, inputs.serverId),
        eq(serverMembers.userId, user.id)
      ),
    });

    if (!membership) {
      error('Unauthorized - you are not a member of this server', 403);
    }

    // Create the channel
    const channelId = randomBytes(16).toString('hex');
    const now = new Date();

    const newChannel = {
      id: channelId,
      serverId: inputs.serverId,
      name: inputs.name,
      createdAt: now,
    };

    await derived.db.insert(channels).values(newChannel);

    return newChannel;
  },
});

/**
 * Get message history for a channel
 * Requires user to be a member of the server
 * Resource: messages/channel/${channelId}
 */
server.defineProcedure('getMessages', {
  resources: ({ inputs }) => {
    return [`messages/channel/${inputs.channelId}`];
  },
  procedure: async ({ inputs, derived, error }) => {
    const user = derived.requireAuth();

    // Get the channel to find the server
    const channel = await derived.db.query.channels.findFirst({
      where: eq(channels.id, inputs.channelId),
    });

    if (!channel) {
      throw error('Channel not found', 404);
    }

    // Verify user is a member of the server
    const membership = await derived.db.query.serverMembers.findFirst({
      where: and(
        eq(serverMembers.serverId, channel.serverId),
        eq(serverMembers.userId, user.id)
      ),
    });

    if (!membership) {
      error('Unauthorized - you are not a member of this server', 403);
    }

    // Get messages (with user info for username)
    const channelMessages = await derived.db.query.messages.findMany({
      where: eq(messages.channelId, inputs.channelId),
      orderBy: (messages, { desc }) => [desc(messages.createdAt)],
      limit: inputs.limit || 50,
      with: {
        user: true,
      },
    });

    // Map to include username (denormalized for convenience)
    return channelMessages.map((msg: any) => ({
      id: msg.id,
      channelId: msg.channelId,
      userId: msg.userId,
      username: msg.user.username,
      content: msg.content,
      createdAt: msg.createdAt,
    })).reverse(); // Oldest first
  },
});

/**
 * Chat channel - realtime bidirectional communication
 * Scoped by serverId and channelId parameters
 *
 * This is the key feature demonstrating Covenant's realtime capabilities!
 */
server.defineChannel('chat', {
  /**
   * onConnect: Called when a client connects to the channel
   * Used to validate the connection and set up per-connection context
   */
  onConnect: async ({ inputs, params, ctx, reject }) => {
    // Check authentication
    if (!ctx.user) {
      reject('Unauthorized - please log in', 'client');
      return null as any;
    }

    const user = ctx.user;

    // Verify the channel exists
    const channel = await db.query.channels.findFirst({
      where: eq(channels.id, params.channelId),
    });

    if (!channel) {
      reject('Channel not found', 'client');
      return null as any; // TypeScript needs this but it won't execute
    }

    // Verify the channel belongs to the specified server
    if (channel.serverId !== params.serverId) {
      reject('Channel does not belong to this server', 'client');
      return null as any;
    }

    // Verify user is a member of the server
    const membership = await db.query.serverMembers.findFirst({
      where: and(
        eq(serverMembers.serverId, params.serverId),
        eq(serverMembers.userId, user.id)
      ),
    });

    if (!membership) {
      reject('You are not a member of this server', 'client');
      return null as any;
    }

    // Connection is valid! Return context for this connection
    return {
      userId: user.id,
      username: inputs.username,
    };
  },

  /**
   * onMessage: Called when a client sends a message
   * Used to process the message and broadcast to all connected clients
   */
  onMessage: async ({ inputs, params, context }) => {
    // Save message to database
    const messageId = randomBytes(16).toString('hex');
    const now = new Date();

    await db.insert(messages).values({
      id: messageId,
      channelId: params.channelId,
      userId: context.userId,
      content: inputs.content,
      createdAt: now,
    });

    // Broadcast to ALL clients connected to this channel
    // The params (serverId, channelId) ensure only clients in this specific channel receive it
    await server.postChannelMessage('chat', params, {
      id: messageId,
      content: inputs.content,
      username: context.username,
      userId: context.userId,
      createdAt: now,
    });
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
