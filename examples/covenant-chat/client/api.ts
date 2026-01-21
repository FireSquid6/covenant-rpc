import { covenant } from "@/lib/covenant";
import { httpClientToServer, httpClientToSidekick } from "@covenant/rpc/interfaces/http";
import { CovenantReactClient } from "@covenant/react";

// we can't use assertReadFromEnv because of the way next works
const covenantUrl = process.env["NEXT_PUBLIC_COVENANT_URL"];
const sidekickUrl = process.env["NEXT_PUBLIC_SIDEKICK_URL"];

if (covenantUrl === undefined) {
  console.log("NEXT_PUBLIC_COVENANT_URL needs to be a url");
  process.exit(1);
}

if (sidekickUrl === undefined) {
  console.log("NEXT_PUBLIC_SIDEKICK_URL needs to be a url");
  process.exit(1);
}

export const api = new CovenantReactClient(covenant, {
  serverConnection: httpClientToServer(covenantUrl, {}),
  sidekickConnection: httpClientToSidekick(sidekickUrl),
});
