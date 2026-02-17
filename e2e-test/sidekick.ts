import { startSidekickServer } from "@covenant-rpc/server/sidekick/webserver";
import { httpSidekickToServer } from "@covenant-rpc/server";

export function startSidekick() {
  return startSidekickServer({
    port: 8121,
    secret: "sidekick-key",
    authFailureDelayMs: 0,
    serverConnection: httpSidekickToServer("http://localhost:8120/api/covenant", "sidekick-key"),
  });
}
