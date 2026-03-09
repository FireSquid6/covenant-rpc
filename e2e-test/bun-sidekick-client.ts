import { CovenantClient, httpClientToServer, httpClientToSidekick } from "@covenant-rpc/client";
import { covenant } from "./covenant";

export function getBunSidekickClient() {
  return new CovenantClient(covenant, {
    serverConnection: httpClientToServer("http://localhost:8122/api/covenant", {}),
    sidekickConnection: httpClientToSidekick("http://localhost:8122"),
  });
}
