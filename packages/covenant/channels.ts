import { z } from "zod";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ChannelDeclaration } from ".";
import type { ArrayToMap, MaybePromise } from "./utils";
import type { ChannelDefinition } from "./server";
import { serializedRequestSchema } from "@covenant/request-serializer";

export const channelErrorSchema = z.object({
  error: z.string(),
  cause: z.union([z.literal("server"), z.literal("client")]),
})

// helpful types
export type InferChannelInputs<T> = T extends ChannelDeclaration<
  infer Inputs,
  any,
  any,
  any,
  any
> ? StandardSchemaV1.InferOutput<Inputs> : never

export type InferChannelOutputs<T> = T extends ChannelDeclaration<
  any,
  infer Outputs,
  any,
  any,
  any
> ? StandardSchemaV1.InferOutput<Outputs> : never


export type InferConnectionRequest<T> = T extends ChannelDeclaration<
  any,
  any,
  infer ConnectionRequest,
  any,
  any
> ? StandardSchemaV1.InferOutput<ConnectionRequest> : never

export type InferChannelContext<T> = T extends ChannelDeclaration<
  any,
  any,
  any,
  infer ChannelContext,
  any
> ? StandardSchemaV1.InferOutput<ChannelContext> : never

export type InferChannelParams<T> = T extends ChannelDeclaration<
  any,
  any,
  any,
  any,
  infer Params
> ? ArrayToMap<Params> : never;


// these come to and from sidekick. They do not need to be stronly typed
export const connectionRequest = z.object({
  channel: z.string(),
  connectionRequest: z.unknown(),
  params: z.record(z.string(), z.string()),
});

export type ConnectionRequest = z.infer<typeof connectionRequest>;
export type LocalConnectionRequest = Omit<ConnectionRequest, "originalRequest">;

// sent from the edge function to the sidekick. Sidekick then sends various
// messages depending on what happens here to the client
export const connectionResponse = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ERROR"),
    error: channelErrorSchema,
  }),
  z.object({
    type: z.literal("OK"),
    context: z.unknown(),
  })
]);


export type ConnectionResponse = z.infer<typeof connectionResponse>;


// these are sent from the server back to sidekick after processing a message
export const untypedServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("OK"),
    message: z.unknown(),
    params: z.record(z.string(), z.string()),
    channel: z.string(),
  }),
  z.object({
    type: z.literal("ERROR"),
    error: channelErrorSchema,
  })
]);

export type UntypedServerMessage = z.infer<typeof untypedServerMessageSchema>;


// these are sent from sidekick to the server and from the server back to sid
// TODO: give this the "original request" system?
export const sidekickChannelMessage = z.object({
  channel: z.string(),
  params: z.record(z.string(), z.string()),
  message: z.unknown(),
  context: z.unknown(),
  key: z.string(),
})

export type SidekickChannelMessage = z.infer<typeof sidekickChannelMessage>;



