import { z } from "zod";
import { declareCovenant, query, mutation } from "@covenant/rpc";
import { todosSelectSchema } from "@/db/schema";


export const covenant = declareCovenant({
  channels: {},
  procedures: {
    getTodos: query({
      input: z.null(),
      output: z.array(todosSelectSchema),
    }),
    makeTodo: mutation({
      input: z.object({
        text: z.string(),
        completed: z.boolean(),
      }),
      output: todosSelectSchema,
    }),
    updateTodo: mutation({
      input: z.object({
        id: z.string(),
        completed: z.boolean(),
        text: z.string(),
      }),
      output: todosSelectSchema,
    }),
    deleteTodo: mutation({
      input: z.object({
        id: z.string(),
      }),
      output: z.null(),
    }),
  },
})
