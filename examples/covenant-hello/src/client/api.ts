import { CovenantClient } from "@covenant/rpc/client";
import { httpClientToServer } from "@covenant/rpc/interfaces/http";
import { emptyClientToSidekick } from "@covenant/rpc/interfaces/empty";
import { assertEnvVar } from "@/utils";

const url = assertEnvVar("NEXT_PUBLIC_COVENANT_URL");


export const covenantClient = new CovenantClient(
  httpClientToServer(url, {}),
  emptyClientToSidekick(),
)
