import { z } from "zod";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ChannelDeclaration } from ".";
import { createMappedSchema } from "./utils";



// schema for messages sent from the sidekick to the server
export function getClientMessageSchema<
  Inputs extends StandardSchemaV1,
  Context extends StandardSchemaV1,
  Params extends string[]
>(i: Inputs, c: Context, p: Params) {
  return z.object({
    channel: z.string(),
    params: createMappedSchema(p),
    inputs: i,
    context: c,
  });
}



// messages sent *FROM* the client
export type ClientMessage<T> = T extends ChannelDeclaration<infer Inputs, any, any, infer Context, infer Params>
  ? ReturnType<typeof getClientMessageSchema<Inputs, Context, Params>>
  : never



// messages sent *FROM* the server 
export function getServerMessageSchema<
  Outputs extends StandardSchemaV1,
  Context extends StandardSchemaV1,
  Params extends string[]
>(o: Outputs, c: Context, p: Params) {
  return z.object({
    channel: z.string(),
    params: createMappedSchema(p),
    inputs: o,
    context: c,
  });
}

export type ServerMessage<T> = T extends ChannelDeclaration<infer Inputs, any, any, infer Context, infer Params>
  ? ReturnType<typeof getServerMessageSchema<Inputs, Context, Params>>
  : never
