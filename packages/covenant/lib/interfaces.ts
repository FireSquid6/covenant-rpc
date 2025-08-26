import type { ChannelConnectionPayload, ChannelConnectionResponse, ServerMessage } from "./channel";
import type { ProcedureResponse } from "./procedure";
import type { SidekickIncomingMessage, SidekickOutgoingMessage } from "./sidekick";


export interface ClientToServerConnection {
  sendConnectionRequest(): Promise<ChannelConnectionResponse>;
  runProcedure(): Promise<ProcedureResponse>;
}


export interface ClientToSidekickConnection {
  sendMessage(message: SidekickIncomingMessage): void;
  onMessage(message: SidekickOutgoingMessage): void;
}


export interface ServerToSidekickConnection {
  addConnection(payload: ChannelConnectionPayload): Promise<Error | null>;
  update(resources: string[]): Promise<Error | null>;
  postMessage(message: ServerMessage): Promise<Error | null>;
}


