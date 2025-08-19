import { connectionResponse, type ConnectionRequest, type ConnectionResponse, type SidekickChannelMessage } from "covenant/channels";


// connects sidekick to edge functions defined by the user
export interface EdgeConnection {
  connectClient: (req: ConnectionRequest) => Promise<ConnectionResponse>
  sendMessage: (msg: SidekickChannelMessage) => Promise<null | Error>
}

export function httpEdgeConnection(endpoint: string): EdgeConnection {
  return {
    async connectClient(req: ConnectionRequest) {
      console.log(endpoint);
      const url = new URL(endpoint);
      url.searchParams.set("type", "connect");

      console.log(url.toString());
      const res = await fetch(url.toString(), {
        method: "POST",
        body: JSON.stringify(req),
      });

      if (!res.ok) {
        // we throw an error here because it indicates
        // that the developer using covenant has fucked up,
        // not necessarily the user
        throw new Error(`Recieved bad response when trying to initiate connection: ${res.status} - ${res.statusText}`);
      }


      const { data, error, success } = connectionResponse.safeParse(await res.json());

      if (!success) {
        throw new Error(`Failed to parse body from edge connection: ${error}. This probably means you configured the endpoint on sidekick wrong`);
      }

      return data;
    },

    async sendMessage(msg: SidekickChannelMessage): Promise<null | Error> {
      

      return null;
    }
  }
}
