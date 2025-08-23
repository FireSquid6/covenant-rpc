import { z } from "zod";
import { declareCovenant, query, mutation } from "covenant";
import { selectUserSchema, todosSelectSchema } from "@/db/schema";


export const covenant = declareCovenant({
  channels: {},
  procedures: {
    helloWorld: query({
      input: z.object({
        name: z.string(),
      }),
      output: z.string(),
    }),

    getTodos: query({
      input: z.undefined(),
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
      output: z.undefined(),
    }),
  },
  // data has not been implemented yet
  data: z.undefined(),
  context: z.object({
    user: z.nullable(selectUserSchema),
  })
})
