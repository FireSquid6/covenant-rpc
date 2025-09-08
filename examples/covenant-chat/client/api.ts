import { covenant } from "@/lib/covenant";
import { assertReadFromEnv } from "@/lib/utils";
import { CovenantClient } from "@covenant/rpc/client";
import { httpClientToServer, httpClientToSidekick } from "@covenant/rpc/interfaces/http";

const covenantUrl = assertReadFromEnv("NEXT_PUBLIC_COVENANT_URL");
const sidekickUrl = assertReadFromEnv("NEXT_PUBLIC_SIDEKICK_URL");

export const api = new CovenantClient(covenant, {
  serverConnection: httpClientToServer(covenantUrl, {}),
  sidekickConnection: httpClientToSidekick(sidekickUrl),
});
