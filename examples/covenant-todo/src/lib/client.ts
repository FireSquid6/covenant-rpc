import { CovenantClient } from "@covenant/rpc/client";
import { covenant } from "./covenant";
import { httpClientToServer } from "@covenant/rpc/interfaces/http";
import { emptyClientToSidekick } from "@covenant/rpc/interfaces/empty";


export const covenantClient = new CovenantClient(covenant, {
  serverConnection: httpClientToServer("http://localhost:3000/api/covenant", {}),
  sidekickConnection: emptyClientToSidekick()
});
