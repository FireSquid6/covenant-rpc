import type { ClientToSidekickConnection, ServerToSidekickConnection } from ".";
import type { MaybePromise } from "../utils";
import type { SidekickOutgoingMessage, SidekickIncomingMessage } from "../sidekick/protocol";

export class MockSidekick {
  private listeners: ((m: SidekickOutgoingMessage) => MaybePromise<void>)[] = [];

  update() {

  }
  onMessage(handler: (m: SidekickOutgoingMessage) => MaybePromise<void>): () => void {
    this.listeners.push(handler);
    return () => {
      const newListeners = this.listeners.filter(l => l !== handler);
      this.listeners = newListeners;
    }
  }
}

export function mockServerToSidekick(): ServerToSidekickConnection {
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
