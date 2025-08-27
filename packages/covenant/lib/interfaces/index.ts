import type { MaybePromise } from "../utils";
import type { ChannelConnectionPayload, ChannelConnectionRequest, ChannelConnectionResponse, ServerMessage } from "../channel";
import type { ProcedureRequestBody, ProcedureResponse } from "../procedure";
import type { SidekickIncomingMessage, SidekickOutgoingMessage } from "../sidekick/protocol";


export interface ClientToServerConnection {
  sendConnectionRequest(request: ChannelConnectionRequest): Promise<ChannelConnectionResponse>;
  runProcedure(request: ProcedureRequestBody): Promise<ProcedureResponse>;
}


export interface ClientToSidekickConnection {
  sendMessage(message: SidekickIncomingMessage): void;
  onMessage(handler: (m: SidekickOutgoingMessage) => MaybePromise<void>): () => void;
}


export interface ServerToSidekickConnection {
  addConnection(payload: ChannelConnectionPayload): Promise<Error | null>;
  update(resources: string[]): Promise<Error | null>;
  postMessage(message: ServerMessage): Promise<Error | null>;
}


