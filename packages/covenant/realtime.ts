import type { MaybePromise } from "bun";
import { z } from "zod";
import type { LocalConnectionRequest, UntypedServerMessage } from "./channels";
import type { ChannelMessage } from "sidekick";

export const resourceUpdateSchema = z.object({
  resources: z.array(z.string()),
  secret: z.string(),
})
export type RealtimeUpdate = z.infer<typeof resourceUpdateSchema>;

// this is the connection from the covenant server to the realtime server
export interface RealtimeConnection {
  informUpdated: (resources: string[]) => Promise<Error | null>;
  sendMessage: (message: UntypedServerMessage) => Promise<Error | null>;
  validateKey: (key: string) => boolean;
}


// this is the connection from the client to the realtime server

export interface RealtimeClient {
  connect(request: LocalConnectionRequest, listener: (i: unknown) => MaybePromise<void>): Promise<() => void>;
  disconnect(request: LocalConnectionRequest, listener: (i: unknown) => MaybePromise<void>):  Promise<void>;
  send(message: Omit<ChannelMessage, "type">): void
  subscribeToResources(resources: string[], listener: () => MaybePromise<void>):  Promise<void>;
  unsubscribeFromResources(resources: string[], listener: () => MaybePromise<void>): Promise<void>;
  getSubscribedResources(): string[];
  getSubscribedChannelTopics(): string[];
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
        return null;
      }

      return new Error(`Error ${response.status} when posting update: ${await response.text()}`)
    },
    sendMessage: async (message: UntypedServerMessage) => {
      console.log(`Making request to ${url}/message`);
      const res = await fetch(`${url}/message`,{
        body: JSON.stringify(message),
        method: "POST",
        headers: {
          "authorization": `Bearer ${secret}`,
        }
      })

      if (!res.ok) {
        return new Error(`Sending message to sidekick failed: ${res.status} - ${res.statusText}`);
      }

      return null;
    },
    validateKey: (key: string) => {
      return key === secret;
    }
  }
}


