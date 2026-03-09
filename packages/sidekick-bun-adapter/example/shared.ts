import { z } from "zod";
import { channel, declareCovenant, query } from "@covenant-rpc/core";
import { SidekickIntegratedCovenantServer } from "..";

export const covenant = declareCovenant({
  procedures: {
    hello: query({
      input: z.object({
        name: z.string(),
      }),
      output: z.object({
        message: z.string(),
      }),
    }),
  },
  channels: {
    chatChannel: channel({
      params: ["channelId"],
      connectionRequest: z.object({
        password: z.string(),
        username: z.string(),
      }),
      connectionContext: z.object({
        id: z.string(),
        username: z.string(),
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

const PASSWORD = "open-sesame";

export function main() {
  const covenantServer = new SidekickIntegratedCovenantServer(covenant, {
    contextGenerator: () => {},
    derivation: () => {},
  });

  covenantServer.defineProcedure("hello", {
    procedure: ({ inputs }) => ({ message: `Hello, ${inputs.name}!` }),
    resources: () => [],
  });

  covenantServer.defineChannel("chatChannel", {
    onConnect({ inputs, reject }) {
      if (inputs.password !== PASSWORD) {
        reject("Wrong password", "client");
      }
      return { id: crypto.randomUUID(), username: inputs.username };
    },
    onMessage({ inputs, context, params }) {
      covenantServer.sendMessage("chatChannel", params, {
        content: inputs.content,
        sender: context.username,
      });
    },
  });

  covenantServer.assertAllDefined();

  Bun.serve({
    routes: {
      "/api/covenant": (req) => covenantServer.handle(req),
      "/socket": (req, server) => covenantServer.handleSocket(req, server),
    },
    websocket: covenantServer.getWebsocket(),
    port: 6739,
  });

  console.log("Server running on port 6739");
  console.log(`Password: "${PASSWORD}"`);
  console.log("Usage: bun example/client.ts [channelId] [username] [password]");
}
