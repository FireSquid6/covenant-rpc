import { z } from "zod";
import { declareCovenant, query, mutation } from "covenant";
import { selectGuildSchema, selectMessageSchema, selectUserSchema } from "@/db/schema";


export const covenant = declareCovenant({
  channels: {},
  procedures: {
    getMessages: query({
      input: z.object({
        guild: z.string(),
        channel: z.string(),
      }),
      output: z.array(selectMessageSchema),
    }),
    createGuild: query({
      input: z.object({
        name: z.string(),
      }),
      output: selectGuildSchema,
    })
  },

  // data has not been implemented yet
  context: z.object({
    user: z.nullable(selectUserSchema),
  })
})
