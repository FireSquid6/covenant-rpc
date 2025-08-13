import type { ElysiaWS } from "elysia/ws";
import type { IncomingMessage, ListenMessage, OutgoingMessage } from ".";

export interface SocketContext {
  listeningMap: Map<string, string[]>;
}

export function handleMessage(message: IncomingMessage, ctx: SocketContext, ws: ElysiaWS): OutgoingMessage {
  switch (message.type) {
    case "subscribe":
      throw new Error("subscribe not implemented");
    case "unsubscribe":
      throw new Error("unsubscribe not implemented");
    case "message":
      throw new Error("message not implemented");
    case "listen":
      
    case "unlisten":
  }
}


export function handleListenMessage(message: ListenMessage, ctx: SocketContext, ws: ElysiaWS): OutgoingMessage {

}
