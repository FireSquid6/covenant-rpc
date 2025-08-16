import type { MaybePromise } from "bun";
import { z } from "zod";
import type { ConnectionRequest, UntypedServerMessage } from "./channels";

export const resourceUpdateSchema = z.object({
  resources: z.array(z.string()),
  secret: z.string(),
})
export type RealtimeUpdate = z.infer<typeof resourceUpdateSchema>;

// this is the connection from the covenant server to the realtime server
export interface RealtimeConnection {
  informUpdated: (resources: string[]) => Promise<Error | "OK">;
  sendMessage: (message: UntypedServerMessage) => Promise<void>;
}


// this is the connection from the client to the realtime server
export interface RealtimeClient {
  // connect: (r: ConnectionData) => ClientChannel;

  connect(request: ConnectionRequest, listener: (i: unknown) => MaybePromise<void>): Promise<() => void>;
  disconnect(request: ConnectionRequest, listener: (i: unknown) => MaybePromise<void>):  Promise<void>;
  subscribeToResources(resources: string[], listener: () => MaybePromise<void>):  Promise<void>;
  unsubscribeFromResources(resources: string[], listener: () => MaybePromise<void>): Promise<void>;
}

export function httpRealtimeConnection(url: string, secret: string): RealtimeConnection {
  return {
    informUpdated: async (resources: string[]) => {
      const update: RealtimeUpdate = {
        resources,
        secret,
      }

      const response = await fetch(`${url}/update`, {
        body: JSON.stringify(update),
        method: "POST",
      });

      if (response.status >= 200 && response.status < 400) {
        return "OK";
      }

      return new Error(`Error ${response.status} when posting update: ${await response.text()}`)
    },
    sendMessage: async () => {
      console.log("sent the message?")
    }
  }
}




export class ClientChannel<
  Input,
  Output
> {
  private messageListeners: ((i: Output, channel: ClientChannel<Input, Output>) => MaybePromise<void>)[] = [];
  private onDisconnect: () => void;
  private onSend: (i: Input) => void;

  constructor(onDisconnect: () => void, onSend: () => void) {
    this.onDisconnect = onDisconnect;
    this.onSend = onSend;
  }
  
  onMessage() {

  }

  sendMessage(i: Input) {
    this.onSend(i);
  }

  disconnect() {
    this.onDisconnect();

  }
}

