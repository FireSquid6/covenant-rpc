import type { StandardSchemaV1 } from "@standard-schema/spec";


export type ProcedureType = "mutation" | "query";

export interface ProcedureDeclaration<
  InputSchema extends StandardSchemaV1,
  OutputSchema extends StandardSchemaV1,
> {
  input: InputSchema;
  output: OutputSchema;
  type: ProcedureType;
}

export type ProcedureMap = { [procedure: string]: ProcedureDeclaration<StandardSchemaV1, StandardSchemaV1> }

export interface ChannelDeclaration<
  ClientMessage extends StandardSchemaV1,
  ServerMessage extends StandardSchemaV1,
> {
  clientMessage: ClientMessage,
  serverMessage: ServerMessage
}

export type ChannelMap = { [channel: string]: ChannelDeclaration<StandardSchemaV1, StandardSchemaV1> }


export interface Covenant<
  P extends ProcedureMap,
  C extends ChannelMap,
> {
  procedures: P;
  channels: C;
}


// helper function to decare the covenant while inferring the type of it
// at the same time
export function declareCovenant<P extends ProcedureMap, C extends ChannelMap>(covenant: Covenant<P, C>): Covenant<P, C> {
  return covenant;
}

