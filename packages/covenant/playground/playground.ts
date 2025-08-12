import { declareCovenant, mutation, query } from "../";
import { CovenantClient, httpMessenger, type QueryKey } from "../client";
import type { Flatten } from "../utils";
import { z } from "zod";
import { CovenantServer } from "../server";


export const covenant = declareCovenant({
  procedures: {
    findUser: query({
      input: z.object({
        id: z.string(),
      }),
      output: z.object({
        id: z.string(),
        username: z.string(),
        image: z.string(),
        email: z.string(),
        verified: z.boolean(),
      }),
      resources: ({ id }) => [`/routes/${id}`],
    }),
    createUser: mutation({
      input: z.object({
        id: z.string(),
      }),
      output: z.void(),
      resources: ({ id }) => [`/routes/${id}`],
    })
  },
  channels: {},
})


export const client = new CovenantClient(covenant, httpMessenger({ 
  httpUrl: "http://localhost:4320/api" 
}));

type queryKey = Flatten<QueryKey<typeof covenant.procedures>>;
const k = client.localListen("findUser", { id: "hello" }, () => {})


export const server = new CovenantServer(covenant, { contextGenerator: () => undefined });
server.defineProcedure("createUser", (i) => {

})

const res = await client.mutate("createUser", {
  id: "uid1",
})

if (res.result === "ERROR") {
  console.log(res.error);
  console.log(res.data);
} else {
  console.log(res.data);
  console.log(res.error)
}


