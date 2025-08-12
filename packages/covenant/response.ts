import { z } from "zod";
import type { StandardSchemaV1 } from "@standard-schema/spec";

export const procedureErrorSchema = z.object({
  message: z.string(),
  httpCode: z.number(),
});

export type ProcedureError = z.infer<typeof procedureErrorSchema>;

export function getProcedureResponseSchema<T extends StandardSchemaV1>(result: T) {
  return z.discriminatedUnion("result", [
    z.object({
      result: z.literal("OK"),
      error: z.undefined(),
      data: result,
    }),
    z.object({
      result: z.literal("ERROR"),
      error: procedureErrorSchema,
      data: z.undefined(),
    })
  ])
}

export type ProcedureResponse<T extends StandardSchemaV1> = StandardSchemaV1.InferOutput<
  ReturnType<
    typeof getProcedureResponseSchema<T>
  >
>


export function procedureResponseToJs(res: ProcedureResponse<any>, headers: Headers): Response {
  return Response.json(res, { status: res.result === "OK" ? 201 : res.error.httpCode, headers });
}
