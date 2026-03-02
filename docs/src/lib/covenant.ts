import { declareCovenant, query, mutation } from "@covenant-rpc/core";
import { z } from "zod";

const todoSchema = z.object({ id: z.string(), text: z.string() });

export const covenant = declareCovenant({
  procedures: {
    getTodos: query({
      input: z.null(),
      output: z.array(todoSchema),
    }),
    addTodo: mutation({
      input: z.object({ text: z.string() }),
      output: todoSchema,
    }),
    deleteTodo: mutation({
      input: z.object({ id: z.string() }),
      output: z.null(),
    }),
  },
  channels: {},
});
