import type { ClientToSidekickConnection, ServerToSidekickConnection } from ".";
import type { Sidekick, SidekickClient } from "../sidekick";
import type { SidekickIncomingMessage, SidekickOutgoingMessage } from "../sidekick/protocol";


export function mockServerToSidekick(sidekick: Sidekick): ServerToSidekickConnection {
  return {
    async addConnection(p) {
      sidekick.addConnection(p);
      return null;
    },
    async update(resources: string[]) {
      await sidekick.updateResources(resources);
      return null;
    },
    async postMessage(m) {
      await sidekick.postServerMessage(m);
      return null;
    }
  }
}

export function mockClientToSidekick(sidekick: Sidekick, client: SidekickClient): ClientToSidekickConnection {
  return {
    sendMessage(message: SidekickIncomingMessage) {
      sidekick.handleClientMessage(client, message);
    },
    onMessage(v) {

    }
  }
}
