import { startSidekickServer } from "@covenant-rpc/server/sidekick/webserver";

export function startSidekick() {
  startSidekickServer({
    port: 8121,
    secret: "sidekick-key",
    authFailureDelayMs: 0,
  });
}
