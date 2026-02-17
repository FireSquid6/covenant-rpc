import { CovenantClient, httpClientToServer, httpClientToSidekick } from "@covenant-rpc/client";
import { covenant } from "./covenant";




export function getNewClient() {
  return new CovenantClient(covenant, {
    serverConnection: httpClientToServer("http://localhost:8120/api/covenant", {}),
    sidekickConnection: httpClientToSidekick("http://localhost:8121"),
  });
}
