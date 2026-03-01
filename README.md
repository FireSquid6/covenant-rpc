# Covenant RPC

Covenant RPC solves querying your backend from your frontend. Define a typed contract once, implement it on the server, call it from the client — with full TypeScript inference throughout, automatic cache invalidation, and optional realtime channels.

Built to be AI-agent-friendly: the covenant file is the only context an agent needs to work with either side of the stack.

## Installation

```bash
bun add @covenant-rpc/core @covenant-rpc/server @covenant-rpc/client

# For React
bun add @covenant-rpc/react

# Pick a schema validator (any Standard Schema compliant library works)
bun add zod
```

## Quick Start

**1. Define the covenant** — a shared file imported by both frontend and backend:

```ts
// covenant.ts
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
  },
  channels: {},
});
```

**2. Implement the server:**

```ts
// server.ts
import { CovenantServer } from "@covenant-rpc/server";
import { emptyServerToSidekick } from "@covenant-rpc/server/interfaces/empty";
import { covenant } from "./covenant";

const todos: { id: string; text: string }[] = [];

export const server = new CovenantServer(covenant, {
  contextGenerator: async ({ request }) => ({
    authHeader: request.headers.get("Authorization"),
  }),
  derivation: ({ ctx, error }) => ({
    requireAuth: () => {
      if (!ctx.authHeader) error("Unauthorized", 401);
      return ctx.authHeader!;
    },
  }),
  sidekickConnection: emptyServerToSidekick(),
});

server.defineProcedure("getTodos", {
  resources: () => ["todos"],
  procedure: () => todos,
});

server.defineProcedure("addTodo", {
  resources: ({ outputs }) => ["todos", `todo/${outputs.id}`],
  procedure: ({ inputs }) => {
    const todo = { id: crypto.randomUUID(), text: inputs.text };
    todos.push(todo);
    return todo;
  },
});

server.assertAllDefined();
```

**3. Mount in your framework** (Next.js example):

```ts
// app/api/covenant/route.ts
import { vanillaAdapter } from "@covenant-rpc/server/adapters/vanilla";
import { server } from "@/lib/server";

const handler = vanillaAdapter(server);
export { handler as GET, handler as POST };
```

**4. Call from the client:**

```ts
// client.ts
import { CovenantClient } from "@covenant-rpc/client";
import { httpClientToServer } from "@covenant-rpc/client/interfaces/http";
import { emptyClientToSidekick } from "@covenant-rpc/client/interfaces/empty";
import { covenant } from "./covenant";

export const client = new CovenantClient(covenant, {
  serverConnection: httpClientToServer("/api/covenant", {}),
  sidekickConnection: emptyClientToSidekick(),
});

const result = await client.query("getTodos", null);
if (result.success) {
  console.log(result.data); // { id: string, text: string }[]
}

await client.mutate("addTodo", { text: "Buy milk" });
```

## React

```ts
import { CovenantReactClient } from "@covenant-rpc/react";

export const client = new CovenantReactClient(covenant, { /* connections */ });

function TodoList() {
  const { loading, data, error } = client.useQuery("getTodos", null);

  if (loading) return <Spinner />;
  if (error) return <p>{error.message}</p>;
  return <ul>{data.map(t => <li key={t.id}>{t.text}</li>)}</ul>;
}

function AddTodo() {
  const [addTodo, { loading }] = client.useMutation("addTodo");
  return (
    <button onClick={() => addTodo({ text: "New todo" })} disabled={loading}>
      Add
    </button>
  );
}
```

## Documentation

Full docs in `docs/`. Start with the [Handbook Overview](docs/src/content/docs/handbook/overview.mdx) or run the docs site:

```bash
cd docs && bun install && bun dev
```

## Packages

| Package | Purpose |
|---------|---------|
| `@covenant-rpc/core` | `declareCovenant`, `query`, `mutation`, `channel` |
| `@covenant-rpc/server` | `CovenantServer`, `vanillaAdapter`, Sidekick |
| `@covenant-rpc/client` | `CovenantClient` |
| `@covenant-rpc/react` | `CovenantReactClient` with React hooks |
