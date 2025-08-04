import type { ParsedRequest } from ".";
import { z } from "zod";


export const covenantRequestSchema = z.object({
  function: z.string(),
  inputs: z.any(),
});

export type CovenantResponse = z.infer<typeof covenantRequestSchema>;

export async function parseRequest(req: Request): Promise<ParsedRequest | Response> {
  const url = new URL(req.url);

  const { data, success } = covenantRequestSchema.safeParse(await req.json());

  if (!success) {
    return new Response("Improper covenant request schema", { status: 400 })
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

