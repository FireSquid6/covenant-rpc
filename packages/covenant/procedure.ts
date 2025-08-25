import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ProcedureDeclaration, ProcedureType } from ".";
import type { MaybePromise } from "bun";
import { v } from "./validation";

export interface ProcedureRequest {
  headers: Headers;
  input: unknown;
  url: string;
  procedure: string;
  path: string;
  req: Request;
}

export interface ProcedureInputs<Inputs, Context, Derivation> {
  inputs: Inputs,
  ctx: Context,
  derived: Derivation,
  request: ProcedureRequest,
  setHeader: (name: string, value: string) => void;
  deleteHeader: (name: string) => void;
  error: (message: string, code: number) => never;
}

export interface ResourceInputs<Inputs, Context, Outputs> {
  inputs: Inputs,
  ctx: Context,
  outputs: Outputs,
}

export type ProcedureDefinition<T, ContextSchema extends StandardSchemaV1, Derivation> = T extends ProcedureDeclaration<
  infer InputSchema,
  infer OutputSchema,
  ProcedureType> ? {
    procedure: (i: ProcedureInputs<
      StandardSchemaV1.InferOutput<InputSchema>,
      StandardSchemaV1.InferOutput<ContextSchema>,
      Derivation
    >) => MaybePromise<StandardSchemaV1.InferOutput<OutputSchema>>
    resources: (i: ResourceInputs<
      StandardSchemaV1.InferOutput<InputSchema>,
      StandardSchemaV1.InferOutput<ContextSchema>,
      StandardSchemaV1.InferOutput<OutputSchema>
    >) => MaybePromise<string[]>
  } : never


export const procedureErrorSchema = v.obj({
  message: v.string(),
  code: v.number(),
});

export type ProcedureError = v.Infer<typeof procedureErrorSchema>;


export const procedureResponseSchema = v.union(
  v.obj({
    status: v.literal("OK"),
    data: v.unknown(),
  }),
  v.obj({
    status: v.literal("OK"),
    error: procedureErrorSchema,
  }),
);

export type ProcedureResponse = v.Infer<typeof procedureResponseSchema>;
