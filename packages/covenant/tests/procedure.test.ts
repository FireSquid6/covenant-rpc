import { z } from "zod";
import { test, expect } from "bun:test";
import { declareCovenant, query, mutation } from "../lib";
import { CovenantServer } from "../lib/server";
import { emptyClientToSidekick, emptyServerToSidekick } from "../lib/interfaces/empty";
import { CovenantClient } from "../lib/client";
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
    context: z.undefined(),
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
    context: z.null(),
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

// TODO: test procedure with context

