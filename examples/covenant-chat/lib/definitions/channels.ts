import { server } from "../server";
import { createChannel, deleteChannel, getServerWithChannels, getUserServersWithChannels, getMessages, createMessage } from "../db/servers";
import { db } from "../db";
import { user } from "../db/schema";
import { eq } from "drizzle-orm";
import { covenant } from "../covenant";


export function defineServerAndChannelProcs() {
  server.defineProcedure("getServer", {
    procedure: async ({ inputs, derived, error }) => {
      derived.forceAuthenticated();

      const server = await getServerWithChannels(inputs.serverId);

      if (!server) {
        throw error(`Server ${inputs.serverId} not found`, 404);
      }

      return server;
    },
    resources: ({ outputs }) => {
      const res = [`/servers/${outputs.server.id}`];
      
      for (const c of outputs.channels) {
        res.push(`/channels/${c.id}`);
      }

      return res;
    },
  });

  server.defineProcedure("getJoinedServers", {
    procedure: async ({ derived }) => {
      const { user } = derived.forceAuthenticated();
      const servers = await getUserServersWithChannels(user.id);
      return servers;
    },
    resources: ({ outputs }) => {
      const res = [];
      for (const s of outputs) {
        res.push(`/servers/${s.server.id}`);
        for (const c of s.channels) {
          res.push(`/channels/${c.id}`);
        }
      }
      return res;
    }
  });

  server.defineProcedure("createChannel", {
    procedure: async ({ derived, inputs }) => {
      derived.forceAuthenticated();
      // TODO - ensure user has the authority to do the thing 

      const channel = await createChannel(inputs.serverId, inputs.name);
      return channel;
    },
    resources: ({ outputs }) => [`/channels/${outputs.id}`],
  });

  server.defineProcedure("deleteChannel", {
    procedure: async ({ derived, inputs }) => {
      derived.forceAuthenticated();
      await deleteChannel(inputs.channelId);

      return undefined;
    },
    resources: ({ inputs }) => [`/channels/${inputs.channelId}`],
  });

  server.defineProcedure("getMessages", {
    procedure: async ({ derived, inputs }) => {
      derived.forceAuthenticated();
      const messages = await getMessages(inputs.channelId, inputs.limit);
      return messages;
    },
    resources: ({ inputs }) => [`/channels/${inputs.channelId}/messages`],
  });

  server.defineProcedure("sendMessage", {
    procedure: async ({ derived, inputs }) => {
      const { user } = derived.forceAuthenticated();
      const message = await createMessage(inputs.channelId, user.id, inputs.content);

      server.sendMessage("chat", { channelId: message.channelId }, {
        message: message,
        // Figure out why user.image is either null or undefined in this case. Weird.
        user: {
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
          name: user.name,
          image: user.image ?? null,
          updatedAt: user.updatedAt,
          createdAt: user.createdAt,
        },
      })

      return message;
    },
    resources: ({ inputs }) => [`/channels/${inputs.channelId}/messages`],
  });
}

export function defineChat() {
  server.defineChannel("chat", {
    onConnect: async ({ inputs, params, reject }) => {
      // Verify the channelId matches the params
      if (inputs.channelId !== params.channelId) {
        reject("Channel ID mismatch", "client");
      }

      // TODO: In production, verify user has access to this channel
      // by checking membership/permissions in the database
      // For now, we trust the userId from the client

      // TODO: Replace userId in connectionRequest with proper auth
      // This should validate a session token or JWT instead

      return {
        channelId: params.channelId,
        userId: inputs.userId,
      };
    },
    onMessage: async ({ inputs, params, context }) => {
      // When a client sends a message, store it and broadcast to all subscribers
      const channelId = params.channelId;
      const userId = context.userId;

      // Store the message in the database
      const message = await createMessage(channelId, userId, inputs.content);

      // Fetch user data for the broadcast
      const users = await db.select().from(user).where(eq(user.id, userId)).limit(1);
      const messageUser = users.length > 0 ? users[0] : null;

      // Broadcast to all connected clients in this channel
      await server.sendMessage("chat", { channelId }, {
        message,
        user: messageUser,
      });
    },
  });
}
