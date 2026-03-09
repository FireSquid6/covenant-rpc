import { covenant } from "./covenant";
import { vanillaAdapter } from "@covenant-rpc/server";
import { SidekickIntegratedCovenantServer } from "@covenant-rpc/sidekick-bun-adapter";

const server = new SidekickIntegratedCovenantServer(covenant, {
  contextGenerator: () => {},
  derivation: () => {},
  logLevel: "debug",
});

server.defineProcedure("getData", {
  procedure: ({ inputs }) => ({ str: `got data: ${inputs}`, n: 42 }),
  resources: ({ inputs }) => [`/data/${inputs}`],
});

server.defineProcedure("updateData", {
  procedure: () => null,
  resources: ({ inputs }) => [`/data/${inputs}`],
});

server.defineProcedure("helloWorld", {
  procedure: ({ inputs }) => `Hello, ${inputs}`,
  resources: () => [],
});

server.defineProcedure("failingQuery", {
  procedure: ({ inputs, error }) => {
    if (inputs) error("Intentional failure", 400);
    return "success";
  },
  resources: () => [],
});

server.defineProcedure("updateAllData", {
  procedure: () => "All data was updated",
  resources: () => ["/data/*"],
});

server.defineChannel("chatroom", {
  onConnect({ inputs, reject }) {
    if (inputs.connectionId === 42) {
      reject("42 is not a valid connection id", "client");
    }
    return { connectionId: inputs.connectionId };
  },
  onMessage({ inputs, context, params }) {
    server.sendMessage("chatroom", params, {
      senderId: context.connectionId,
      message: inputs.message,
    });
  },
});

server.assertAllDefined();

export function startBunSidekickServer() {
  return Bun.serve({
    port: 8122,
    routes: {
      "/api/covenant": vanillaAdapter(server),
      "/socket": (req, bunServer) => server.handleSocket(req, bunServer),
    },
    websocket: server.getWebsocket(),
  });
}
