import { covenant } from "./covenant";
import { CovenantServer, httpServerToSidekick, vanillaAdapter } from "@covenant-rpc/server";



export const covenantServer = new CovenantServer(covenant, {
  contextGenerator: () => {},
  derivation: () => {},
  sidekickConnection: httpServerToSidekick("http://localhost:8121", "sidekick-key"),
  logLevel: "debug",
});




export function startCovenant() {
  const handler = vanillaAdapter(covenantServer);

  return Bun.serve({
    port: 8120,
    routes: {
      "/api/covenant": handler,
    }
  });
}


