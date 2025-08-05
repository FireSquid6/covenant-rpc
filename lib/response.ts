import type { StandardSchemaV1 } from "@standard-schema/spec";
import { z } from "zod";
import { CovenantError, CovenantRedirect } from ".";

export function getResponseSchema<T extends StandardSchemaV1>(outputs: T) {
  return z.discriminatedUnion("status", [
    z.object({
      status: z.literal("OK"),
      body: outputs,
    }),
    z.object({
      status: z.literal("ERROR"),
      httpCode: z.number(),
      fault: z.union([z.literal("server"), z.literal("client")]),
      message: z.string(),
    }),
    z.object({
      status: z.literal("REDIRECT"),
      httpCode: z.number(),
      to: z.string(),
    })
  ])
}

export type CovenantResponse<T extends StandardSchemaV1> = z.infer<ReturnType<typeof getResponseSchema<T>>>;


export function covenantResponseToJsResonse(res: CovenantResponse<any>, headers: Headers): Response {
  switch (res.status) {
    case "OK":
      return Response.json(res, { status: 201, headers });
    case "REDIRECT":
      return Response.redirect(res.to, res.httpCode);
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
  if (e instanceof CovenantRedirect) {
    return {
      status: "REDIRECT",
      to: e.to,
      httpCode: e.type === "permanent" ? 301 : 303
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
