import { z } from "zod";
import { declareCovenant } from "@covenant-rpc/core";
import { mutation, query } from "@covenant-rpc/core";

export const taskSchema = z.object({
  id: z.string(),
  text: z.string(),
  description: z.string(),
  date: z.date(),
})



export const covenant = declareCovenant({
  // queries indicate functions that simply
  // get data
  procedures: {
    getTask: query({
      input: z.object({
        id: z.string(),
      }),
      output: taskSchema,
    }),
    // mutations indicate functions that modify
    // create or delete data
    createTask: mutation({
      input: z.object({
        text: z.string(),
        description: z.string(),
      }),
      output: taskSchema,
    }),
  },
  // we'll cover channels later
  channels: {}
})
