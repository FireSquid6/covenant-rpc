import type { ClientToSidekickConnection, ServerToSidekickConnection } from ".";
import type { Sidekick } from "../sidekick";




export function mockServerToSidekick(sidekick: Sidekick): ServerToSidekickConnection {
  return {
    async addConnection() {
      return null;
    },
    async update(resources: string[]) {
      return null;
    },
    async postMessage() {
      return null;
    }
  }
}

export function mockClientToSidekick(mock: MockSidekick): ClientToSidekickConnection {

}
