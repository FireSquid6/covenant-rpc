import { z } from "zod";
import { channel, declareCovenant, mutation, query } from "@covenant-rpc/core";


export const dataSchema = z.object({
  str: z.string(),
  n: z.number(),
});
export type Data = z.infer<typeof dataSchema>;


export const covenant = declareCovenant({
  procedures: {
    updateData: mutation({
      input: z.string(),
      output: z.null(),
    }),
    getData: query({
      input: z.string(),
      output: dataSchema,
    }),
    helloWorld: query({
      input: z.string(),
      output: z.string(),
    }),
    failingQuery: query({
      input: z.boolean(),
      output: z.string(),
    }),
    updateAllData: mutation({
      input: z.null(),
      output: z.string(),
    }),
  },
  channels: {
    chatroom: channel({
      clientMessage: z.object({
        message: z.string(),
      }),
      serverMessage: z.object({
        senderId: z.number(),
        message: z.string(),
      }),
      connectionContext: z.object({
        connectionId: z.number(),
      }),
      connectionRequest: z.object({
        connectionId: z.number(),
      }),
      params: ["chatChannel"],
    }),
  },
});
