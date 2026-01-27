import type { ServerToSidekickConnection } from "@covenant/core/lib/interfaces";

export function emptyServerToSidekick(): ServerToSidekickConnection {
  return {
    addConnection: async () => null,
    update: async () => null,
    postMessage: async () => null,
  }
}
