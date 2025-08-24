import { z } from "zod";
import { declareCovenant, query, mutation } from "covenant";
import { selectUserSchema } from "@/db/schema";


export const covenant = declareCovenant({
  channels: {},
  procedures: {
    helloWorld: query({
      input: z.object({
        name: z.string(),
      }),
      output: z.string(),
    }),
  },
  // data has not been implemented yet
  data: z.undefined(),
  context: z.object({
    user: z.nullable(selectUserSchema),
  })
})
