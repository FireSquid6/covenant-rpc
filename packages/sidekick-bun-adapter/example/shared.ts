import { z } from "zod";
import { channel, declareCovenant, mutation, query } from "@covenant-rpc/core";
import { SidekickIntegratedCovenantServer } from "..";


export const covenant = declareCovenant({
  procedures: {
    hello: query({
      input: z.object({
        name: z.string(),
      }),
      output: z.object({
        message: z.string(),
      })
    }),
    update: mutation({
      input: z.object({
        name: z.string(),
      }),
      output: z.null(),
    }),
  },
  channels: {
    chatChannel: channel({
      params: ["channelId"],
      connectionRequest: z.object({
        password: z.string(),
      }),
      connectionContext: z.object({
        id: z.string(),
      }),
      clientMessage: z.object({
        content: z.string(), 
      }),
      serverMessage: z.object({
        content: z.string(),
        sender: z.string(),
      }),
    }),
  },
});


export function main() {
  const covenantServer = new SidekickIntegratedCovenantServer(covenant, {
    contextGenerator: () => {},
    derivation: () => {},
  });




  const bunServer = Bun.serve({
    routes: {
      "/api/covenant": (req) => {
        return covenantServer.handle(req);
      },
      "/sidekick/socket": (req) => {
        return covenantServer.handleSocket(req);
      }
    },
    websocket: covenantServer.getWebsocket(),
    port: 6739,
  })

  covenantServer.setServer(bunServer);
  console.log(`Running on port: ${6739}`)
}
