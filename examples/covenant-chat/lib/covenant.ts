import { declareCovenant, mutation, query, channel } from "@covenant/core";
import { z } from "zod";
import { channelTableSchema, serverTableSchema, messageTableSchema, userTableSchema } from "./db/schema";


export const covenant = declareCovenant({
  procedures: {
    getJoinedServers: query({
      input: z.undefined(),
      output: z.array(z.object({
        server: serverTableSchema,
        channels: z.array(channelTableSchema), 
      })),
    }),
    createChannel: mutation({
      input: z.object({
        serverId: z.string(),
        name: z.string(),
      }),
      output: channelTableSchema,
    }),
    deleteChannel: mutation({
      input: z.object({
        channelId: z.string(),
      }),
      output: z.undefined(),
    }),
    getServer: query({
      input: z.object({
        serverId: z.string(),
      }),
      output: z.object({
        server: serverTableSchema,
        channels: z.array(channelTableSchema),
      }),
    }),
    getMessages: query({
      input: z.object({
        channelId: z.string(),
        limit: z.number().optional(),
      }),
      output: z.array(z.object({
        message: messageTableSchema,
        user: userTableSchema.nullable(),
      })),
    }),
    sendMessage: mutation({
      input: z.object({
        channelId: z.string(),
        content: z.string(),
      }),
      output: messageTableSchema,
    }),
    // TODO: join server, create server, delete server, modify server
    //
  },
  channels: {
    chat: channel({
      clientMessage: z.object({
        content: z.string(),
      }),
      serverMessage: z.object({
        message: messageTableSchema,
        user: userTableSchema.nullable(),
      }),
      connectionRequest: z.object({
        channelId: z.string(),
        userId: z.string(), // TODO: Replace with proper auth token
      }),
      connectionContext: z.object({
        channelId: z.string(),
        userId: z.string(),
      }),
      params: ["channelId"],
    }),
  },
})
