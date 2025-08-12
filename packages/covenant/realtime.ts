import { z } from "zod";

export const resourceUpdateSchema = z.object({
  resources: z.array(z.string()),
  secret: z.string(),
})

// this is the connection from the covenant server to the realtime server
export interface RealtimeConnection {
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
    informUpdated: async (resources: string[]) => {

    },
  }
}
