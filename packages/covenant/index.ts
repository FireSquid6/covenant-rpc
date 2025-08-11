import type { StandardSchemaV1 } from "@standard-schema/spec";


export type ProcedureType = "mutation" | "query"

export interface ProcedureDeclaration<
  InputSchema extends StandardSchemaV1,
  OutputSchema extends StandardSchemaV1,
  T extends ProcedureType
> {
  input: InputSchema;
  output: OutputSchema;
  type: T;
  resources: (i: StandardSchemaV1.InferOutput<InputSchema>) => string[]
}

export type ProcedureMap = { [procedure: string]: ProcedureDeclaration<any, any, any> }

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


export function mutation<
  Inputs extends StandardSchemaV1,
  Outputs extends StandardSchemaV1,
>({ input, output, resources }: {
  input: Inputs,
  output: Outputs,
  resources: (i: StandardSchemaV1.InferOutput<Inputs>) => string[],
}): ProcedureDeclaration<Inputs, Outputs, "mutation"> {
  return {
    type: "mutation",
    input,
    output,
    resources,
  }
}

export function query<
  Inputs extends StandardSchemaV1,
  Outputs extends StandardSchemaV1,
>({ input, output, resources }: {
  input: Inputs,
  output: Outputs,
  resources: (i: StandardSchemaV1.InferOutput<Inputs>) => string[],
}): ProcedureDeclaration<Inputs, Outputs, "query"> {
  return {
    type: "query",
    input,
    output,
    resources,
  }
}
