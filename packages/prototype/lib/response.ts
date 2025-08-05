import type { StandardSchemaV1 } from "@standard-schema/spec";
import { z } from "zod";
import { CovenantError } from ".";

export function getResponseSchema<T extends StandardSchemaV1>(result: T) {
  return z.discriminatedUnion("status", [
    z.object({
      status: z.literal("OK"),
      data: result,
    }),
    z.object({
      status: z.literal("ERROR"),
      message: z.string(),
      fault: z.union([z.literal("server"), z.literal("client")]),
      httpCode: z.number(),
    })
  ])
}

export type CovenantResponse<T extends StandardSchemaV1> = StandardSchemaV1.InferOutput<ReturnType<typeof getResponseSchema<T>>>

export function covenantResponseToJsResonse(res: CovenantResponse<any>, headers: Headers): Response {
  switch (res.status) {
    case "OK":
      return Response.json(res, { status: 201, headers });
    case "ERROR":
      return Response.json(res, { status: res.httpCode, headers })
  }
}



export function handleCatch(e: unknown): CovenantResponse<any> {
  if (e instanceof CovenantError) {
    return {
      status: "ERROR",
      httpCode: e.httpCode,
      message: e.message,
      fault: e.fault,
    }
  }
  if (e instanceof Error) {
    const err = CovenantError.fromError(e);
    return {
      status: "ERROR",
      httpCode: err.httpCode,
      message: err.message,
      fault: err.fault,
    }
  }

  const err = CovenantError.fromUnknown(e);
  return {
    status: "ERROR",
    httpCode: err.httpCode,
    message: err.message,
    fault: err.fault,
  }
}
