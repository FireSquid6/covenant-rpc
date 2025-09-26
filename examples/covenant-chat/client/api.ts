import { covenant } from "@/lib/covenant";
import { assertReadFromEnv } from "@/lib/utils";
import { httpClientToServer, httpClientToSidekick } from "@covenant/rpc/interfaces/http";
import { CovenantReactClient } from "@covenant/react";

const covenantUrl = assertReadFromEnv("NEXT_PUBLIC_COVENANT_URL");
const sidekickUrl = assertReadFromEnv("NEXT_PUBLIC_SIDEKICK_URL");

export const api = new CovenantReactClient(covenant, {
  serverConnection: httpClientToServer(covenantUrl, {}),
  sidekickConnection: httpClientToSidekick(sidekickUrl),
});
