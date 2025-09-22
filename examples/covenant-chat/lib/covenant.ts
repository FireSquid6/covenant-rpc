import { declareCovenant, mutation, query } from "@covenant/rpc";
import { z } from "zod";


export const covenant = declareCovenant({
  procedures: {
    getJoinedServers: query({
      input: z.undefined(),
      output
    }),
  },
  channels: {},
})
