import { z } from "zod";
import { declareCovenant, mutation, query } from "@covenant-rpc/core";


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
    })
  },
  channels: {},
});
