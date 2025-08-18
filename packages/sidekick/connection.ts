import type { ConnectionRequest, ConnectionResponse, SidekickChannelMessage } from "covenant/channels";


// connects sidekick to edge functions defined by the user
export interface EdgeConnection {
  connectClient: (req: ConnectionRequest) => Promise<ConnectionResponse>
  sendMessage: (msg: SidekickChannelMessage) => Promise<null | Error>
}
