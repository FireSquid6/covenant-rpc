import { declareCovenant, mutation, query } from "../";
import { CovenantClient, httpMessenger, type QueryKey } from "../client";
import type { Flatten } from "../utils";
import { z } from "zod";
import { CovenantServer } from "../server";
import { setDefaultTimeout } from "bun:test";


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
    }),
    createUser: mutation({
      input: z.object({
        id: z.string(),
      }),
      output: z.void(),
    })
  },
  channels: {},
  context: z.object({
    userId: z.string(),
  }),
  data: z.any(),
})


export const client = new CovenantClient(covenant, httpMessenger({
  httpUrl: "http://localhost:4320/api"
}));

type queryKey = Flatten<QueryKey<typeof covenant.procedures>>;
const k = client.localListen("findUser", { id: "hello" }, () => { })


export const server = new CovenantServer(covenant, {
  contextGenerator: () => {
    return {
      userId: "user"
    }
  },
});
server.defineProcedure("createUser", {
  procedure: (i) => {
  },
  resources: () => ["users/id"],
})


const res = await client.query("findUser", {
  id: "uid1",
})

if (res.result === "ERROR") {
  console.log(res.error);
} else {
  console.log(res.resources);
  console.log(res.data);
}

