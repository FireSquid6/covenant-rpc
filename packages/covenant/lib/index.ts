import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { MaybePromise } from "./utils";
import type { ProcedureInputs } from "./procedure";


export type ProcedureType = "mutation" | "query";


export interface ProcedureDeclaration<
  InputSchema extends StandardSchemaV1,
  OutputSchema extends StandardSchemaV1,
  T
> {
  input: InputSchema;
  output: OutputSchema;
  type: T;
}


export type ProcedureMap = { [p: string]: ProcedureDeclaration<StandardSchemaV1, StandardSchemaV1, ProcedureType> };


export interface ChannelDeclaration<
  ClientMessageSchema extends StandardSchemaV1,
  ServerMessageSchema extends StandardSchemaV1,
  ConnectionRequestSchema extends StandardSchemaV1,
  ConnectionContextSchema extends StandardSchemaV1,
  Params extends string[],
> {
  clientMessage: ClientMessageSchema,
  serverMessage: ServerMessageSchema,
  connectionRequest: ConnectionRequestSchema,
  connectionContext: ConnectionContextSchema,
  params: Params,
}


export type ChannelMap = {
  [channel: string]: ChannelDeclaration<
    StandardSchemaV1,
    StandardSchemaV1,
    StandardSchemaV1,
    StandardSchemaV1,
    string[]
  >
}


export interface Covenant<
  P extends ProcedureMap,
  C extends ChannelMap,
> {
  procedures: P,
  channels: C,
}

export function declareCovenant<
  P extends ProcedureMap,
  C extends ChannelMap,
>(covenant: Covenant<P, C>): Covenant<P, C> {
  return covenant;
}

export function mutation<
  Inputs extends StandardSchemaV1,
  Outputs extends StandardSchemaV1,
>({ input, output }: {
  input: Inputs,
  output: Outputs,
}): ProcedureDeclaration<Inputs, Outputs, "mutation"> {
  return {
    type: "mutation",
    input,
    output,
  }
}

export function query<
  Inputs extends StandardSchemaV1,
  Outputs extends StandardSchemaV1,
>({ input, output }: {
  input: Inputs,
  output: Outputs,
}): ProcedureDeclaration<Inputs, Outputs, "query"> {
  return {
    type: "query",
    input,
    output,
  }
}


// helper function to get better autocomplete
export function channel<
  ClientMessageSchema extends StandardSchemaV1,
  ServerMessageSchema extends StandardSchemaV1,
  ConnectionRequestSchema extends StandardSchemaV1,
  ConnectionContextSchema extends StandardSchemaV1,
  Params extends string[],
>(c: {
  clientMessage: ClientMessageSchema,
  serverMessage: ServerMessageSchema,
  connectionRequest: ConnectionRequestSchema,
  connectionContext: ConnectionContextSchema,
  params: Params,
}) {
  return c;
}


export type ContextGenerator<Context extends StandardSchemaV1> = 
  (i: ProcedureInputs<unknown, undefined, undefined>) => MaybePromise<StandardSchemaV1.InferOutput<Context>>
