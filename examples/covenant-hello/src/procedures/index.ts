import { covenant } from "@/lib/covenant";
import { emptyServerToSidekick } from "@covenant/client/lib/interfaces/empty";
import { CovenantServer } from "@covenant/server";


export const server = new CovenantServer(covenant, {
  sidekickConnection: emptyServerToSidekick(),
  contextGenerator: () => undefined,
  derivation: () => undefined,
});



server.defineProcedure("hello", {
  procedure: ({ inputs }) => {
    return {
      message: `Hello, ${inputs.name}. This is from the server!`,
    }
  },
  resources: ({ inputs }) => [`/hello/${inputs.name}`],
});


server.assertAllDefined();

