import { CovenantError, type ParsedRequest } from ".";
import { z } from "zod";


export const covenantRequestSchema = z.object({
  function: z.string(),
  inputs: z.any(),
});

export type CovenantRequest = z.infer<typeof covenantRequestSchema>;

export async function parseRequest(req: Request): Promise<ParsedRequest> {
  const url = new URL(req.url);

  const { data, error, success } = covenantRequestSchema.safeParse(await req.json());

  if (!success) {
    throw new CovenantError(`Didn't recieve expected schema: ${error.message}`, "client");
  }
  
  return {
    req,
    headers: req.headers,
    input: data.inputs,
    functionName: data.function,
    path: url.pathname,
    url: req.url,
  }
}



