import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ProcedureDeclaration, ProcedureType } from ".";
import type { MaybePromise } from "bun";
import { v } from "./validation";
import type { Logger } from "./logger";

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
  logger: Logger,
  setHeader: (name: string, value: string) => void;
  deleteHeader: (name: string) => void;
  error: (message: string, code: number) => never;
}

export interface ResourceInputs<Inputs, Context, Outputs> {
  inputs: Inputs,
  logger: Logger,
  ctx: Context,
  outputs: Outputs,
}

export type ProcedureDefinition<T, Context, Derivation> = T extends ProcedureDeclaration<
  infer InputSchema,
  infer OutputSchema,
  ProcedureType> ? {
    procedure: (i: ProcedureInputs<
      StandardSchemaV1.InferOutput<InputSchema>,
      Context,
      Derivation
    >) => MaybePromise<StandardSchemaV1.InferOutput<OutputSchema>>
    resources: (i: ResourceInputs<
      StandardSchemaV1.InferOutput<InputSchema>,
      Context,
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
    resources: v.array(v.string()),
  }),
  v.obj({
    status: v.literal("ERR"),
    error: procedureErrorSchema,
  }),
);

export type ProcedureResponse = v.Infer<typeof procedureResponseSchema>;

export const procedureRequestBodySchema = v.obj({
  procedure: v.string(),
  inputs: v.unknown(),
});

export type ProcedureRequestBody = v.Infer<typeof procedureRequestBodySchema>;


export type InferProcedureInputs<P> = P extends ProcedureDeclaration<
  infer InputSchema,
  any,
  any
> ? StandardSchemaV1.InferInput<InputSchema> : never;


export type InferProcedureOutputs<P> = P extends ProcedureDeclaration<
  any,
  infer OutputSchema,
  any
> ? StandardSchemaV1.InferOutput<OutputSchema> : never


export type InferProcedureResult<P> = {
  success: true,
  data: InferProcedureOutputs<P>,
  resources: string[]
  error: null,
} | {
  success: false,
  error: ProcedureError,
  data: null,
  resources: null,
}
