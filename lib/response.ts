import { z } from "zod";

export const covenantResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("OK"),
    body: z.any(),
  }),
  z.object({
    status: z.literal("ERROR"),
    fault: z.union([z.literal("server"), z.literal("client")]),
    message: z.string(),
  }),
]);

export type CovenantResponse = z.infer<typeof covenantResponseSchema>;


  
 

