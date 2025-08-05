import { declareCovenant } from "..";
import { CovenantClient, httpMessenger } from "../lib/client";
import { z } from "zod";
import { CovenantServer } from "../lib/server";


export const covenant = declareCovenant({
  procedures: {
    findUser: {
      input: z.object({
        id: z.string(),
      }),
      output: z.object({
        id: z.string(),
        username: z.string(),
        image: z.string(),
        email: z.string(),
        verified: z.boolean(),
      })
    }
  },
  channels: {},
})



export const client = new CovenantClient(covenant, httpMessenger({ 
  procedureUrl: "http://localhost:4320/api" 
}));


export const server = new CovenantServer(covenant, { contextGenerator: () => undefined });

const res = await client.call("findUser", {
  id: "uid1",
})

if (res.result === "ERROR") {
  console.log(res.error);
  console.log(res.data);
} else {
  console.log(res.data);
  console.log(res.error)
}


