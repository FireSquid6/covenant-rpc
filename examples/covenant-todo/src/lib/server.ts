import { db } from "@/db";
import { DatabaseSession, todosTable, User } from "@/db/schema";
import { getAllTodosForUser, makeTodo, ownsTodo, updateTodo } from "@/db/todo";
import { getUserAndSession } from "@/db/user";
import { covenant } from "@/lib/covenant";
import { emptyRealtimeConnection } from "covenant/realtime";
import { CovenantServer } from "covenant/server";
import { Session } from "next-auth";


export const covenantServer = new CovenantServer(
  covenant,
  {
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
            throw error("Not authenticated", 401);
          }

          return user;
        },
      }
    },
    realtimeConnection: emptyRealtimeConnection(),
  }
)

console.log("defining the procedure");
covenantServer.defineProcedure("helloWorld", {
  procedure: ({ inputs }) => {
    return `Hello, ${inputs.name}`;
  },
  resources: () => [],
});


covenantServer.defineProcedure("getTodos", {
  procedure: async ({ derived }) => {
    const user = await derived.forceAuthenticated();
    return getAllTodosForUser(db, user.id);
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
  resources: ({ ctx, inputs }) => [`/todos/${ctx.user?.id ?? "__null_user__"}/${inputs.id}`],
})

covenantServer.assertAllDefined();


