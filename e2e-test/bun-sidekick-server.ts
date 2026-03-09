import { covenant } from "./covenant";
import { CovenantServer, vanillaAdapter, directSidekickToServer, directServerToSidekick } from "@covenant-rpc/server";
import type { ServerToSidekickConnection } from "@covenant-rpc/core/interfaces";
import { bunSidekickAdapter } from "@covenant-rpc/sidekick-bun-adapter";

const PORT = 8122;
const SECRET = "bun-sidekick-key";

// Mutable proxy — filled in by startBunSidekickServer() once both sides exist.
const serverToSidekickProxy: ServerToSidekickConnection = {
  addConnection: () => Promise.resolve(null),
  update: () => Promise.resolve(null),
  postMessage: () => Promise.resolve(null),
};

const server = new CovenantServer(covenant, {
  contextGenerator: () => {},
  derivation: () => {},
  sidekickConnection: serverToSidekickProxy,
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
  const adapter = bunSidekickAdapter({
    secret: SECRET,
    serverConnection: directSidekickToServer(server),
    authFailureDelayMs: 0,
  });

  // Both sides now exist — wire up server → sidekick direction.
  const real = directServerToSidekick(adapter.sidekick);
  serverToSidekickProxy.addConnection = real.addConnection.bind(real);
  serverToSidekickProxy.update = real.update.bind(real);
  serverToSidekickProxy.postMessage = real.postMessage.bind(real);

  return Bun.serve({
    port: PORT,
    routes: {
      "/api/covenant": vanillaAdapter(server),
      ...adapter.routes(""),
    },
    websocket: adapter.websocket,
  });
}
