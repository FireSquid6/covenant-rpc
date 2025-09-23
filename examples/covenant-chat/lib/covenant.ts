import { declareCovenant, mutation, query } from "@covenant/rpc";
import { z } from "zod";
import { channelTableSchema, serverTableSchema } from "./db/schema";


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
    // TODO: join server, create server, delete server, modify server
    //
  },
  channels: {},
})
