import { z } from "zod";
import { test, expect } from "bun:test";
import { declareCovenant, query } from "../lib";
import { CovenantServer } from "../lib/server";
import { emptyClientToSidekick, emptyServerToSidekick } from "../lib/interfaces/empty";
import { CovenantClient } from "../lib/client";
import { directClientToServerConnection } from "../lib/interfaces/direct";



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
    derivation: () => {},
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
    serverConnection: directClientToServerConnection(server, {}),
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
})
