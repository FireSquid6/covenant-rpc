import { z } from "zod";
import { declareCovenant } from "covenant";



export const covenant = declareCovenant({
  channels: {},
  procedures: {},
  // data has not been implemented yet
  data: z.undefined(),
  context: z.undefined(),
})
