import { z } from "zod";
import { CovenantError } from "./error";
import type { ParsedRequest } from "./server";

export const procedureRequestSchema = z.object({
  procedure: z.string(),
  inputs: z.any(),
});

export type ProcedureRequest = z.infer<typeof procedureRequestSchema>;

export async function parseRequest(req: Request): Promise<ParsedRequest> {
  const url = new URL(req.url);

  const { data, error, success } = procedureRequestSchema.safeParse(await req.json());


  if (!success) {
    throw new CovenantError(`Didn't recieve expected schema: ${error.message}`, 400);
  }

  return {
    req,
    procedure: data.procedure,
    headers: req.headers,
    input: data.inputs,
    path: url.pathname,
    url: req.url,
  }

}
