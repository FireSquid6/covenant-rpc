import { z } from "zod";
import type { ChannelDefinition } from "./server";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ChannelDeclaration } from ".";



// schema for messages sent from the sidekick to the server
export function getClientMessageSchema<Inputs extends StandardSchemaV1, Context extends StandardSchemaV1>(i: Inputs, c: Context) {
  return z.object({
    inputs: i,
    context: c,
  });
}

export type ClientMessage<T> = T extends ChannelDeclaration<infer Inputs, any, any, infer Context, any>
  ? ReturnType<typeof getClientMessageSchema<Inputs, Context>>
  : never


