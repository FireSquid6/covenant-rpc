import { z } from "zod";

export const resourceUpdateSchema = z.object({
  resources: z.array(z.string())
})

// this is the connection from the covenant server to the realtime server
export interface RealtimeConnection {
  sendMessage: () => void;
  informUpdated: (resources: string[]) => Promise<void>;
}


// this is the connection from the client to the realtime server
export interface RealtimeClient {
  // connect: (r: ConnectionData) => ClientChannel;
  subscribeToResources: (resources: string[]) => Promise<void>;
  unsubscribeFromResources: (resources: string[]) => Promise<void>;
}

// the realtime client will return one of these. 
export interface ClientChannel {
  onMessage: () => void;
  close: () => void;
}

export function httpRealtimeConnection(url: string): RealtimeConnection {
  return {
    sendMessage: () => {},
    informUpdated: async (resources: string[]) => {

    },
  }
}
