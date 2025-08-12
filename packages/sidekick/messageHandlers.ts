import type { IncomingMessage, OutgoingMessage } from ".";

export interface SocketContext {
  listeningMap: Map<string, string[]>;
}

export function handleMessage(message: IncomingMessage, ctx: SocketContext): OutgoingMessage {

}
