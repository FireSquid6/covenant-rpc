import { covenant } from "./covenant";
import { CovenantServer, httpServerToSidekick, vanillaAdapter } from "@covenant-rpc/server";



export const covenantServer = new CovenantServer(covenant, {
  contextGenerator: () => {},
  derivation: () => {},
  sidekickConnection: httpServerToSidekick("http://localhost:8121", "sidekick-key"),
  logLevel: "debug",
});


covenantServer.defineProcedure("getData", {
  procedure: ({ inputs }) => {
    return {
      str: `got data: ${inputs}`,
      n: 42,
    }
  },
  resources: ({ inputs }) => {
    return [`/data/${inputs}`];
  },
});


covenantServer.defineProcedure("updateData", {
  procedure: () => {
    return null;
  },
  resources: ({ inputs }) => {
    return [`/data/${inputs}`];
  },
});


covenantServer.defineProcedure("helloWorld", {
  procedure({ inputs }) {
      return `Hello, ${inputs}`;
  },
  resources: () => {
    return [];
  },
});

covenantServer.defineProcedure("failingQuery", {
  procedure: ({ inputs, error }) => {
    if (inputs) {
      error("Intentional failure", 400);
    }
    return "success";
  },
  resources: () => [],
});

covenantServer.assertAllDefined();



export function startCovenant() {
  const handler = vanillaAdapter(covenantServer);

  return Bun.serve({
    port: 8120,
    routes: {
      "/api/covenant": handler,
    }
  });
}


