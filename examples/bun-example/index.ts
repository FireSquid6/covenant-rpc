import { emptyRealtimeConnection } from "covenant/realtime";
import { CovenantServer } from "covenant/server";
import { z } from "zod";
import { declareCovenant, query, channel, mutation } from "covenant";
import { vanillaAdapter } from "covenant/adapters/vanilla";

export const port = 5800;
export const covenant = declareCovenant({
  channels: {},
  procedures: {
    helloWorld: query({
      input: z.object({
        name: z.string(),
      }),
      output: z.string(),
    }),
  },
  context: z.undefined(),
})


export const covenantServer = new CovenantServer(
  covenant,
  {
    contextGenerator: (i) => {
      return undefined;
    },
    derivation: ({ error }) => {
      return {
      }
    },
    realtimeConnection: emptyRealtimeConnection(),

  }
)

covenantServer.defineProcedure("helloWorld", {
  procedure: ({ inputs }) => {
    return `Hello, ${inputs.name}`;
  },
  resources: () => [],
});


covenantServer.assertAllDefined();

const handler = vanillaAdapter(covenantServer)

export function main() {
  Bun.serve({
    routes: {
      "/api": {
        POST: (req) => {
          const t1 = Date.now();
          const res = handler(req);
          const t2 = Date.now();
          
          console.log(`Took ${t2 - t1} ms to process request`);

          return res;
        }
      }
    },
    port,
  });

  console.log(`Server up on port ${port}`);
}
