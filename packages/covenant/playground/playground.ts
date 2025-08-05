import { declareCovenant } from ".";
import { z } from "zod";


export const covenant = declareCovenant({
  procedures: {
    findUser: {
      input: z.object({
        id: z.string(),
      }),
      output: z.optional(z.object({
        id: z.string(),
        username: z.string(),
        image: z.string(),
        email: z.string(),
        verified: z.boolean(),
      }))
    }
  },
  channels: {},
})
