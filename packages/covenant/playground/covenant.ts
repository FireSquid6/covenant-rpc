import { z } from "zod";
import { channel, declareCovenant, mutation, query } from "..";

export const userSchema = z.object({
  userId: z.string(),
  username: z.string(),
  age: z.number(),
});

export type User = z.infer<typeof userSchema>;

export const covenant = declareCovenant({
  context: z.object({
    userId: z.string(),
  }),
  data: z.object({
    userId: z.string(),
    socketId: z.string(),
  }),
  channels: {
    events: channel({
      clientMessage: z.object({
        message: z.string(),
      }),
      serverMessage: z.object({
        sender: z.string(),
        message: z.string(),
      }),
      connectionContext: z.object({
        userId: z.string(),
      }),
      connectionRequest: z.object({
        userId: z.string(),
      }),
      // Important: make sure you include the "as const" part, or else your
      // params will not be strongly typed
      params: ["channelId"] as const,
    })
  },
  procedures: {
    findUsers: query({
      input: z.undefined(),
      output: z.array(userSchema),
    }),

    createUser: mutation({
      input: userSchema,
      output: z.undefined(),
    })
  }
})
