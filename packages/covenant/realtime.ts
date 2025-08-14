import type { MaybePromise } from "bun";
import { z } from "zod";

export const resourceUpdateSchema = z.object({
  resources: z.array(z.string()),
  secret: z.string(),
})
export type RealtimeUpdate = z.infer<typeof resourceUpdateSchema>;

// this is the connection from the covenant server to the realtime server
export interface RealtimeConnection {
  informUpdated: (resources: string[]) => Promise<Error | "OK">;
  sendMessage: () => Promise<void>;
}


// this is the connection from the client to the realtime server
export interface RealtimeClient {
  // connect: (r: ConnectionData) => ClientChannel;
  // handleError(arg: (error: Error) => MaybePromise<void>): void;
  subscribeToResources(resources: string[], onError?: (error: Error) => void | Promise<void>):  Promise<void>;
  unsubscribeFromResources(resources: string[], onError?: (error: Error) => void | Promise<void>): Promise<void>;
}

// the realtime client will return one of these. 
export interface ClientChannel {
  onMessage: () => void;
  close: () => void;
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



