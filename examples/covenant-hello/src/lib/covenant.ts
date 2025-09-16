import { declareCovenant, query } from "@covenant/rpc";
import { z } from "zod";


export const covenant = declareCovenant({
  procedures: {
    hello: query({
      input: z.object({
        name: z.string(),
      }),
      output: z.object({
        message: z.string(),
      }),
    }),
  },
  channels: {},
});
