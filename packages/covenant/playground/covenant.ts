import { z } from "zod";
import { declareCovenant, mutation, query } from "..";

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
  channels: {},
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
