import { CovenantServer } from "@covenant-rpc/server";
import { emptyServerToSidekick } from "@covenant-rpc/server/interfaces/empty";
import { covenant } from "./covenant";

type Todo = { id: string; text: string };

// Module-level store persists between requests for the life of the process
const todos: Todo[] = [
  { id: "1", text: "Read the overview" },
  { id: "2", text: "Try the quickstart" },
];

export const server = new CovenantServer(covenant, {
  contextGenerator: () => undefined,
  derivation: () => ({}),
  sidekickConnection: emptyServerToSidekick(),
});

server.defineProcedure("getTodos", {
  resources: () => ["todos"],
  procedure: () => todos,
});

server.defineProcedure("addTodo", {
  resources: ({ outputs }) => ["todos", `todo/${outputs.id}`],
  procedure: ({ inputs }) => {
    const todo: Todo = { id: crypto.randomUUID(), text: inputs.text };
    todos.push(todo);
    return todo;
  },
});

server.defineProcedure("deleteTodo", {
  resources: ({ inputs }) => ["todos", `todo/${inputs.id}`],
  procedure: ({ inputs, error }) => {
    const i = todos.findIndex((t) => t.id === inputs.id);
    if (i === -1) error("Not found", 404);
    todos.splice(i, 1);
    return null;
  },
});

server.assertAllDefined();
