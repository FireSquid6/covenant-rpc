import { v } from "./validation";
import type { ChannelDeclaration } from ".";
import type { MaybePromise, ArrayToMap } from "./utils";
import type { StandardSchemaV1 } from "@standard-schema/spec";


export const channelErrorSchema = v.obj({
  channel: v.string(),
  params: v.record(v.string(), v.string()),
  fault: v.union(v.literal("server"), v.literal("client"), v.literal("sidekick")),
  message: v.string(),
});
export type ChannelError = v.Infer<typeof channelErrorSchema>;


// sent from the client to the server
export const channelConnectionRequestSchema = v.obj({
  channel: v.string(),
  params: v.record(v.string(), v.string()),
  data: v.unknown(),
});
export type ChannelConnectionRequest = v.Infer<typeof channelConnectionRequestSchema>;

// sent from the server back to the client to inform of a connection
export const channelConnectionResponseSchema = v.obj({
  channel: v.string(),
  params: v.record(v.string(), v.string()),
  result: v.union(
    v.obj({
      type: v.literal("OK"),
      token: v.string(),
    }),
    v.obj({
      type: v.literal("ERROR"),
      error: channelErrorSchema,
    })
  )
});
export type ChannelConnectionResponse = v.Infer<typeof channelConnectionResponseSchema>;

// sent from the server to the sidekick to inform of a new connection
export const channelConnectionPayload = v.obj({
  token: v.string(),
  channel: v.string(),
  params: v.record(v.string(), v.string()),
  context: v.unknown(),
});

export type ChannelConnectionPayload = v.Infer<typeof channelConnectionPayload>;

export const serverMessageSchema = v.obj({
  channel: v.string(),
  params: v.record(v.string(), v.string()),
  data: v.unknown(),
});
export type ServerMessage = v.Infer<typeof serverMessageSchema>;

export const serverMessageWithContext = v.obj({
  channel: v.string(),
  params: v.record(v.string(), v.string()),
  data: v.unknown(),
  context: v.unknown(),
});
export type ServerMessageWithContext = v.Infer<typeof serverMessageWithContext>;

export interface ConnectionHandlerInputs<T, Params> {
  inputs: T,
  params: Params,
  reject(reason: string, cause: "client" | "server"): never,
}

export interface MessageHandlerInputs<T, Params, Context> {
  inputs: T,
  params: Params,
  context: Context,
  error(reason: string, cause: "client" | "server"): never,
}

export type ChannelDefinition<T> = T extends ChannelDeclaration<
  infer ClientMessage,
  any,
  infer ConnectionRequest,
  infer ConnectionContext,
  infer Params
> ? {
  onConnect: (i: ConnectionHandlerInputs<
    StandardSchemaV1.InferOutput<ConnectionRequest>,
    ArrayToMap<Params>
  >) => MaybePromise<
    StandardSchemaV1.InferOutput<ConnectionContext>
  >;
  onMessage: (i: MessageHandlerInputs<
    StandardSchemaV1.InferOutput<ClientMessage>,
    ArrayToMap<Params>,
    StandardSchemaV1.InferOutput<ConnectionContext>
  >) => MaybePromise<
    void
  >
} : never

