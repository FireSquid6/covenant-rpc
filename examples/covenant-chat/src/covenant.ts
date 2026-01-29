import { z } from 'zod';
import { declareCovenant, query, mutation, channel } from '@covenant/core';

/**
 * Covenant definition for the chat application.
 *
 * This file defines the API contract between the client and server.
 * IMPORTANT: Only import validation schemas (like Zod) - never import
 * implementation code, database connections, or business logic.
 */

/**
 * Zod schema for a server
 */
export const serverSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.string(),
  createdAt: z.date(),
});

/**
 * Zod schema for a channel
 */
export const channelSchema = z.object({
  id: z.string(),
  serverId: z.string(),
  name: z.string(),
  createdAt: z.date(),
});

/**
 * Zod schema for a message
 */
export const messageSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  userId: z.string(),
  username: z.string(), // Denormalized for convenience
  content: z.string(),
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
     * Get all servers the authenticated user is a member of
     * Resource: servers/user/${userId}
     */
    getServers: query({
      input: z.null(),
      output: z.array(serverSchema),
    }),

    /**
     * Create a new server
     * Automatically adds the creator as a member
     * Resource: servers/user/${userId}, server/${serverId}
     */
    createServer: mutation({
      input: z.object({
        name: z.string().min(1),
      }),
      output: serverSchema,
    }),

    /**
     * Get all channels in a server
     * Requires user to be a member of the server
     * Resource: channels/server/${serverId}
     */
    getChannels: query({
      input: z.object({
        serverId: z.string(),
      }),
      output: z.array(channelSchema),
    }),

    /**
     * Create a new channel in a server
     * Requires user to be a member of the server
     * Resource: channels/server/${serverId}, channel/${channelId}
     */
    createChannel: mutation({
      input: z.object({
        serverId: z.string(),
        name: z.string().min(1),
      }),
      output: channelSchema,
    }),

    /**
     * Get message history for a channel
     * Requires user to be a member of the server
     * Resource: messages/channel/${channelId}
     */
    getMessages: query({
      input: z.object({
        channelId: z.string(),
        limit: z.number().optional(),
      }),
      output: z.array(messageSchema),
    }),
  },

  channels: {
    /**
     * Realtime chat channel
     * Scoped by serverId and channelId parameters
     *
     * Flow:
     * 1. Client connects with serverId and channelId params
     * 2. Server validates user is member of server in onConnect
     * 3. Client subscribes to receive messages
     * 4. Client sends messages via send()
     * 5. Server broadcasts messages to all connected clients in that channel
     */
    chat: channel({
      // Message from client to server
      clientMessage: z.object({
        content: z.string().min(1).max(2000),
      }),

      // Message from server to client
      serverMessage: z.object({
        id: z.string(),
        content: z.string(),
        username: z.string(),
        userId: z.string(),
        createdAt: z.date(),
      }),

      // Data sent when client connects
      connectionRequest: z.object({
        username: z.string(),
      }),

      // Context stored per connection
      connectionContext: z.object({
        userId: z.string(),
        username: z.string(),
      }),

      // Parameters for scoping connections to specific channels
      params: ['serverId', 'channelId'],
    }),
  },
});

// Export type for use in server and client
export type AppCovenant = typeof appCovenant;
