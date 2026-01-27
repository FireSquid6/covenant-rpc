import { CovenantClient } from "@covenant/client";
import { httpClientToServer } from "@covenant/client/lib/interfaces/http";
import { emptyClientToSidekick } from "@covenant/client/lib/interfaces/empty";
import { assertEnvVar } from "@/utils";
import { covenant } from "@/lib/covenant";

const url = assertEnvVar("NEXT_PUBLIC_COVENANT_URL");


export const covenantClient = new CovenantClient(
  covenant,
  {
    serverConnection: httpClientToServer(url, {}),
    sidekickConnection: emptyClientToSidekick(),
  }
)
