import type { ServerToSidekickConnection } from "@covenant-rpc/core/interfaces";

export function emptyServerToSidekick(): ServerToSidekickConnection {
  return {
    addConnection: async () => null,
    update: async () => null,
    postMessage: async () => null,
  }
}
