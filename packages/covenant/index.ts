import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ParsedRequest } from "./server";

export interface ProcedureInputs<Inputs, Context, Derivation> {
  inputs: Inputs,
  ctx: Context,
  derived: Derivation,
  request: ParsedRequest,
  setHeader: (name: string, value: string) => void;
  deleteHeader: (name: string) => void;
  error: (message: string, code: number) => never;

  // TODO: send messages in specific channels as the result of a mutation 
  // sendMessage?: undefined
}

export interface ResourceInputs<Inputs, Context, Outputs> {
  inputs: Inputs,
  ctx: Context,
  outputs: Outputs,
}

export type ProcedureType = "mutation" | "query"


export interface ProcedureDeclaration<
  InputSchema extends StandardSchemaV1,
  OutputSchema extends StandardSchemaV1,
  T extends ProcedureType
> {
  input: InputSchema;
  output: OutputSchema;
  type: T;
}

export type ProcedureMap = { [procedure: string]: ProcedureDeclaration<any, any, any> }

export interface ChannelDeclaration<
  ClientMessage extends StandardSchemaV1,
  ServerMessage extends StandardSchemaV1,
  ConnectionRequest extends StandardSchemaV1,
  ConnectionContext extends StandardSchemaV1,
  Params extends string[],
> {
  clientMessage: ClientMessage,
  serverMessage: ServerMessage
  connectionRequest: ConnectionRequest,
  connectionContext: ConnectionContext,
  params: string[],
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
  Context extends StandardSchemaV1,
  Data extends StandardSchemaV1,
> {
  procedures: P;
  channels: C;
  context: Context;
  data: Data;
}


// helper function to decare the covenant while inferring the type of it
// at the same time
export function declareCovenant<
  P extends ProcedureMap,
  C extends ChannelMap,
  Context extends StandardSchemaV1,
  Data extends StandardSchemaV1,
>(covenant: Covenant<P, C, Context, Data>): Covenant<P, C, Context, Data> {
  return covenant;
}


export type ContextGenerator<Context extends StandardSchemaV1> = 
  (i: ProcedureInputs<unknown, undefined, undefined>) => StandardSchemaV1.InferOutput<Context>


// helper functions for declaring mutations and queries
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

export function channel<
  ClientMessage extends StandardSchemaV1,
  ServerMessage extends StandardSchemaV1,
  ConnectionRequest extends StandardSchemaV1,
  ConnectionContext extends StandardSchemaV1,
  Params extends string[],
>({ clientMessage, serverMessage, connectionRequest, connectionContext, params }: {
  clientMessage: ClientMessage,
  serverMessage: ServerMessage,
  connectionRequest: ConnectionRequest,
  connectionContext: ConnectionContext,
  params: Params,
}): ChannelDeclaration<ClientMessage, ServerMessage, ConnectionRequest, ConnectionContext, Params> {
  return {
    clientMessage,
    serverMessage,
    connectionRequest,
    connectionContext,
    params,
  }
}
