import { db } from "@/db";
import { User } from "@/db/schema";
import { deleteTodo, getAllTodosForUser, makeTodo, ownsTodo, updateTodo } from "@/db/todo";
import { getUserAndSession } from "@/db/user";
import { covenant } from "@/lib/covenant";
import { CovenantServer } from "@covenant/rpc/server";
import { emptyServerToSidekick } from "@covenant/rpc/interfaces/empty";


export const covenantServer = new CovenantServer(
  covenant,
  {
    sidekickConnection: emptyServerToSidekick(),
    contextGenerator: async () => {
      const auth = await getUserAndSession(db);
      const user = auth?.user ?? null;
      return {
        user: user,
      }
    },
    derivation: ({ error, ctx }) => {
      return {
        forceAuthenticated: async (): Promise<User> => {
          const user = ctx.user;

          if (!user) {
            // throwing an error like this is how we "return early" from a function
            throw error("Not authenticated", 401);
          }

          return user;
        },
      }
    },
  }
)

covenantServer.defineProcedure("getTodos", {
  procedure: async ({ derived }) => {
    const user = await derived.forceAuthenticated();
    const todos = await getAllTodosForUser(db, user.id);
    return todos;
  },
  resources: ({ ctx }) => [`/todos/${ctx.user?.id ?? "__null_user__"}`],
});

covenantServer.defineProcedure("makeTodo", {
  procedure: async ({ derived, inputs }) => {
    const user = await derived.forceAuthenticated();
    const todo = await makeTodo(db, user.id, {
      text: inputs.text,
      completed: inputs.completed,
    });

    return todo;
  },
  resources: ({ ctx }) => [`/todos/${ctx.user?.id ?? "__null_user__"}`],
});

covenantServer.defineProcedure("updateTodo", {
  procedure: async ({ derived, inputs, error }) => {
    const user = await derived.forceAuthenticated();

    // could also fail because there is no todo with that id
    if (!await ownsTodo(db, user.id, inputs.id)) {
      throw error(`Todo id ${inputs.id} does not exist or is not readable by user`, 404);
    }

    const todo = await updateTodo(db, inputs.id, {
      text: inputs.text,
      completed: inputs.completed,
    });

    return todo;
  },
  resources: ({ ctx }) => [`/todos/${ctx.user?.id ?? "__null_user__"}`],
});

covenantServer.defineProcedure("deleteTodo", {
  procedure: async ({ derived, inputs, error }) => {
    const user = await derived.forceAuthenticated();

    if (!await ownsTodo(db, user.id, inputs.id)) {
      throw error(`Todo id ${inputs.id} does not exist or is not readable by user`, 404);
    }

    await deleteTodo(db, inputs.id);

    return null;
  },
  resources: ({ ctx }) => [`/todos/${ctx.user?.id ?? "__null_user__"}`],
})


covenantServer.assertAllDefined();


