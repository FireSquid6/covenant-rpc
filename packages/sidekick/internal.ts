import type { ClientToSidekickConnection, ServerToSidekickConnection } from "@covenant/rpc/interfaces/index";
import { Sidekick, type SidekickClient } from "@covenant/rpc/sidekick/index";
import type { SidekickIncomingMessage, SidekickOutgoingMessage } from "@covenant/rpc/sidekick/protocol";
import type { MaybePromise } from "@covenant/rpc/utils";

// internal sidekick is good when you want you have a single server that can act as a sidekick and the core api (for example,
// when you are not on the edge)
//
//
// TODO - methods for sidekicks to communicate and stay in sync with each other. Need to figure out a smart way to do this.

interface InternalSidekickConsumer {
  client: SidekickClient,
  onMessage: (m: SidekickOutgoingMessage) => MaybePromise<void>
}


export class InternalSidekick {
  private sidekick: Sidekick
  private consumers: InternalSidekickConsumer[] = [];
  // private listeners:

  constructor() {
    this.sidekick = new Sidekick(async () => {

    })

  }

  getConnectionFromServer(): ServerToSidekickConnection {
    // we have to do this because of the way the this
    // keyword works in javascript
    const sidekick = this.sidekick;

    return {
      // these will never fail - no network layer
      async addConnection(payload) {
        sidekick.addConnection(payload); 
        return null;
      },
      async update(resources) {
        await sidekick.updateResources(resources);
        return null;
      },
      async postMessage(message) {
        const res = sidekick.postServerMessage(message);
        return null;
      },
    }
  }

  getConnectionFromClient(): ClientToSidekickConnection {
    const id = crypto.randomUUID();
    const consumer = {
    }


    return {
      sendMessage(message: SidekickIncomingMessage) {
        
      },
      onMessage(handler) {
          
      },
    }
  }

}

