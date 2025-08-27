import type { ClientToServerConnection, ServerToSidekickConnection, ClientToSidekickConnection } from ".";

export function emptyClientToSidekick(): ClientToSidekickConnection {
  return {
    sendMessage() {

    },
    onMessage() {
      return () => { };
    },
  }
}


export function emptyClientToServer(): ClientToServerConnection {
  return {
    async sendConnectionRequest(r) {
      return {
        channel: r.channel,
        params: r.params,
        result: {
          type: "ERROR",
          error: {
            params: r.params,
            channel: r.channel,
            fault: "client",
            message: "Empty connection always fails.",
          }
        }
      }
    },
    async runProcedure() {
      return {
        status: "ERR",
        error: {
          code: 501,
          message: "Using an empty client to server connection",
        },
        resources: [],
      }
    }
  }
}


export function emptyServerToSidekick(): ServerToSidekickConnection {
  return {
    addConnection: async () => null,
    update: async () => null,
    postMessage: async () => null,
  }
}
