import { z } from "zod";
import { test, expect } from "bun:test";
import { declareCovenant, query, mutation } from "@covenant/core";
import { CovenantServer } from "../lib/server";
import { emptyServerToSidekick } from "../lib/interfaces/empty";
import { emptyClientToSidekick } from "@covenant/client";
import { CovenantClient } from "@covenant/client";
import { directClientToServer } from "../lib/interfaces/direct";


test("simple procedure", async () => {
  const covenant = declareCovenant({
    procedures: {
      helloWorld: query({
        input: z.object({
          name: z.string(),
        }),
        output: z.object({
          message: z.string(),
        })
      })
    },
    channels: {},
  });

  const server = new CovenantServer(covenant, {
    contextGenerator: () => undefined,
    derivation: () => { },
    sidekickConnection: emptyServerToSidekick(),
  });

  server.defineProcedure("helloWorld", {
    resources: (i) => {
      return [`greeting/${i.inputs.name}`];
    },
    procedure: ({ inputs }) => {
      return {
        message: `Hello, ${inputs.name}`,
      }
    },
  })

  const client = new CovenantClient(covenant, {
    sidekickConnection: emptyClientToSidekick(),
    serverConnection: directClientToServer(server, {}),
  });

  const result = await client.query("helloWorld", {
    name: "Someone",
  });

  expect(result.success).toBe(true);
  expect(result.error).toBe(null);
  expect(result.data).toEqual({
    message: "Hello, Someone",
  });
  expect(result.resources).toEqual(["greeting/Someone"]);
});

const widgetSchema = z.object({
  id: z.number(),
  name: z.string(),
  price: z.number(),
});
type Widget = z.infer<typeof widgetSchema>;

test("procedure with local listen", async () => {

  const currentWidgets: Widget[] = [
    {
      id: 1,
      name: "Widget one",
      price: 1000000,
    },
  ]

  const covenant = declareCovenant({
    procedures: {
      getWidgets: query({
        input: z.null(),
        output: z.array(widgetSchema),
      }),
      addWidget: mutation({
        input: widgetSchema,
        output: z.null(),
      })
    },
    channels: {},
  });

  const server = new CovenantServer(covenant, {
    contextGenerator: () => null,
    derivation: () => { },
    sidekickConnection: emptyServerToSidekick(),
  });

  server.defineProcedure("addWidget", {
    procedure: ({ inputs }) => {
      currentWidgets.push(inputs);
      return null;
    },
    resources: () => {
      return ["widgets"];
    },
  });

  server.defineProcedure("getWidgets", {
    procedure: () => {
      return currentWidgets;
    },
    resources: () => {
      return ["widgets"];
    },
  });

  const client = new CovenantClient(covenant, {
    sidekickConnection: emptyClientToSidekick(),
    serverConnection: directClientToServer(server, {}),
  });

  // this is really ugly
  const p = new Promise<void>(async (resolveOuter) => {

    await new Promise<void>(async (resolve) => {
      let times = 0;
      const unsubscribe = client.listen("getWidgets", null, (result) => {
        times += 1;
        expect(result.resources).toEqual(["widgets"]);
        expect(result.error).toBe(null);
        expect(result.success).toBe(true);

        switch (times) {
          case 1:
            expect(result.data).toEqual([
              {
                id: 1,
                name: "Widget one",
                price: 1000000,
              },
            ]);
            resolveOuter();
            break;
          case 2:
            expect(result.data).toEqual([
              {
                id: 1,
                name: "Widget one",
                price: 1000000,
              },
              {
                id: 2,
                name: "Widget two",
                price: 1000000,
              },
            ])

            resolve();
            unsubscribe();
            break;
        }
      });
    });
    await p;

    client.mutate("addWidget", {
      id: 2,
      name: "Widget two",
      price: 1000000,
    });
  });
});

test("procedure error handling", async () => {
  const covenant = declareCovenant({
    procedures: {
      failingProcedure: query({
        input: z.object({
          shouldFail: z.boolean(),
        }),
        output: z.object({
          message: z.string(),
        })
      })
    },
    channels: {},
  });

  const server = new CovenantServer(covenant, {
    contextGenerator: () => undefined,
    derivation: () => { },
    sidekickConnection: emptyServerToSidekick(),
  });

  server.defineProcedure("failingProcedure", {
    resources: () => ["test"],
    procedure: ({ inputs, error }) => {
      if (inputs.shouldFail) {
        error("This procedure failed intentionally", 400);
      }
      return {
        message: "Success!",
      }
    },
  })

  const client = new CovenantClient(covenant, {
    sidekickConnection: emptyClientToSidekick(),
    serverConnection: directClientToServer(server, {}),
  });

  // Test successful case
  const successResult = await client.query("failingProcedure", {
    shouldFail: false,
  });

  expect(successResult.success).toBe(true);
  expect(successResult.error).toBe(null);
  expect(successResult.data).toEqual({
    message: "Success!",
  });
  expect(successResult.resources).toEqual(["test"]);

  // Test error case
  const errorResult = await client.query("failingProcedure", {
    shouldFail: true,
  });

  expect(errorResult.success).toBe(false);
  expect(errorResult.data).toBe(null);
  expect(errorResult.resources).toBe(null);
  expect(errorResult.error).toEqual({
    message: "This procedure failed intentionally",
    code: 400,
  });
});

// TODO: test procedure with context

