import type { ServerToSidekickConnection } from "@covenant/core/interfaces";

export function emptyServerToSidekick(): ServerToSidekickConnection {
  return {
    addConnection: async () => null,
    update: async () => null,
    postMessage: async () => null,
  }
}
