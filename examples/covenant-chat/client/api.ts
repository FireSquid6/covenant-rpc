import { covenant } from "@/lib/covenant";
import { httpClientToServer, httpClientToSidekick } from "@covenant/rpc/interfaces/http";
import { CovenantReactClient } from "@covenant/react";

// we can't use assertReadFromEnv because of the way next works
const covenantUrl = process.env["NEXT_PUBLIC_COVENANT_URL"]!;
const sidekickUrl = process.env["NEXT_PUBLIC_SIDEKICK_URL"]!;

export const api = new CovenantReactClient(covenant, {
  serverConnection: httpClientToServer(covenantUrl, {}),
  sidekickConnection: httpClientToSidekick(sidekickUrl),
});
