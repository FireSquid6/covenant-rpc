import type { ClientToSidekickConnection, ServerToSidekickConnection } from "@covenant-rpc/core/interfaces";
import { Sidekick, type SidekickClient } from "@covenant-rpc/server";
import type { SidekickIncomingMessage, SidekickOutgoingMessage } from "@covenant-rpc/core/sidekick/protocol";
import type { MaybePromise } from "@covenant-rpc/core/utils";

// internal sidekick is good when you want you have a single server that can act as a sidekick and the core api (for example,
// when you are not on the edge)
//
//
// TODO - methods for sidekicks to communicate and stay in sync with each other. Need to figure out a smart way to do this.



export class InternalSidekick {
  private sidekick: Sidekick
  private clients: InternalSidekickClient[] = [];
  private serverCallback: ((channelName: string, params: Record<string, string>, data: any, context: any) => Promise<{ fault: "client" | "server"; message: string } | null>) | null = null;

  constructor() {
    const clients = this.clients;
    const getServerCallback = () => this.serverCallback;

    this.sidekick = new Sidekick(async (topic, message) => {
      const subscribed = clients.filter(c => c.isSubscribed(topic));
      for (const s of subscribed) {
        s.directMessage(message)
      }
    })

    // Override the sidekick's server connection
    // @ts-expect-error - accessing private field
    this.sidekick.state.serverConnection = {
      async sendMessage(message) {
        const callback = getServerCallback();
        if (!callback) {
          return {
            fault: "server" as const,
            message: "Server connection not initialized",
            channel: message.channel,
            params: message.params,
          };
        }

        const result = await callback(message.channel, message.params, message.data, message.context);
        if (result) {
          return {
            ...result,
            channel: message.channel,
            params: message.params,
          };
        }
        return null;
      },
    };
  }

  setServerCallback(callback: (channelName: string, params: Record<string, string>, data: any, context: any) => Promise<{ fault: "client" | "server"; message: string } | null>) {
    this.serverCallback = callback;
  }

  getConnectionFromServer(): ServerToSidekickConnection {
    // we have to do this because of the way the this
    // keyword works in javascript
    const sidekick = this.sidekick;

    return {
      // these will never fail - no network layer
      addConnection(payload) {
        sidekick.addConnection(payload); 
        return Promise.resolve(null);
      },
      async update(resources) {
        await sidekick.updateResources(resources);
        return null;
      },
      async postMessage(message) {
        await sidekick.postServerMessage(message);
        return null;
      },
    }
  }

  getConnectionFromClient(): ClientToSidekickConnection {
    const client = new InternalSidekickClient();
    const sidekick = this.sidekick;
    this.clients.push(client);

    return {
      sendMessage(message: SidekickIncomingMessage) {
        sidekick.handleClientMessage(client, message);
      },
      onMessage(handler) {
        return client.addHandler(handler);
      },
    }
  }
}


class InternalSidekickClient implements SidekickClient {
  private id: string;
  private subscribedTopics: Set<string>;
  private handlers: ((m: SidekickOutgoingMessage) => MaybePromise<void>)[];

  constructor() {
    this.id = crypto.randomUUID();
    this.subscribedTopics = new Set();
    this.handlers = [];
  }

  subscribe(topic: string) {
    this.subscribedTopics.add(topic);

  }

  directMessage(message: SidekickOutgoingMessage) {
    for (const h of this.handlers) {
      const p = h(message);
      if (p instanceof Promise) {
        p.catch((e) => {
          throw new Error(`Unhandlable error in message handler: ${e}`);
        });
      }
    }
  }

  getHandlers(): ((m: SidekickOutgoingMessage) => MaybePromise<void>)[] {
    return this.handlers;
  }

  unsubscribe(topic: string): void {
    this.subscribedTopics.delete(topic);
  }

  getId(): string {
    return this.id;
  }

  isSubscribed(topic: string) {
    return this.subscribedTopics.has(topic);
  }

  addHandler(handler: (m: SidekickOutgoingMessage) => MaybePromise<void>) {
    this.handlers.push(handler);

    return () => this.removeHandler(handler);
  }

  removeHandler(handler: (m: SidekickOutgoingMessage) => MaybePromise<void>) {
    this.handlers = this.handlers.filter(h => h !== handler);
  }
}
