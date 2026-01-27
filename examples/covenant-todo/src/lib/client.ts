import { CovenantClient } from "@covenant/client";
import { covenant } from "./covenant";
import { httpClientToServer } from "@covenant/client/interfaces/http";
import { emptyClientToSidekick } from "@covenant/client/interfaces/empty";


export const covenantClient = new CovenantClient(covenant, {
  serverConnection: httpClientToServer("http://localhost:3000/api/covenant", {}),
  sidekickConnection: emptyClientToSidekick()
});
