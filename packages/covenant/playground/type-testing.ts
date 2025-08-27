import { declareCovenant, mutation } from "../lib";
import { z } from "zod";
import { CovenantClient } from "../lib/client";
import { emptyClientToSidekick } from "../lib/interfaces/clientToSidekick";
import { emptyClientToServer } from "../lib/interfaces/empty";
import type { InferProcedureInputs } from "../lib/procedure";


export const covenant = declareCovenant({
  procedures: {
    sayHello: mutation({
      input: z.object({
        template: z.string(),
      }),
      output: z.object({
        message: z.string(),
        name: z.string(),
        numberThing: z.number(),
      })
    })
  },
  channels: {},
  context: z.null(),
});


export const client = new CovenantClient(covenant, {
  sidekickConnection: emptyClientToSidekick(),
  serverConnection: emptyClientToServer(),
});
type i = InferProcedureInputs<typeof covenant.procedures.sayHello>;

