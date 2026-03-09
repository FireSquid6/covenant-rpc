import { z } from "zod";
import { channel, declareCovenant, mutation, query } from "@covenant-rpc/core";
import { CovenantClient, httpClientToServer, httpClientToSidekick } from "@covenant-rpc/client";
import { test, expect, beforeAll } from "bun:test";
import { SidekickIntegratedCovenantServer } from "..";

const covenant = declareCovenant({
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

const PORT = 17433;

const covenantServer = new SidekickIntegratedCovenantServer(covenant, {
  contextGenerator: () => {},
  derivation: () => {},
});

covenantServer.defineProcedure("hello", {
  procedure: ({ inputs }) => ({ message: `Hello, ${inputs.name}!` }),
  resources: ({ inputs }) => [`/name/${inputs.name}`],
});

covenantServer.defineProcedure("update", {
  procedure: () => null,
  resources: ({ inputs }) => [`/name/${inputs.name}`],
});

covenantServer.defineChannel("chatChannel", {
  onConnect({ inputs, reject }) {
    if (inputs.password !== "open-sesame") {
      reject("Wrong password", "client");
    }
    return { id: crypto.randomUUID() };
  },
  onMessage({ inputs, context, params }) {
    covenantServer.sendMessage("chatChannel", params, {
      content: inputs.content,
      sender: context.id,
    });
  },
});

covenantServer.assertAllDefined();

beforeAll(() => {
  Bun.serve({
    port: PORT,
    routes: {
      "/api/covenant": (req) => covenantServer.handle(req),
      "/socket": (req, server) => covenantServer.handleSocket(req, server),
    },
    websocket: covenantServer.getWebsocket(),
  });
});

function getClient() {
  return new CovenantClient(covenant, {
    serverConnection: httpClientToServer(`http://localhost:${PORT}/api/covenant`, {}),
    sidekickConnection: httpClientToSidekick(`http://localhost:${PORT}`),
  });
}

test("hello procedure returns greeting", async () => {
  const client = getClient();
  const res = await client.query("hello", { name: "World" });

  expect(res.success).toBe(true);
  expect(res.data).toEqual({ message: "Hello, World!" });
});

test("channel: wrong password is rejected", async () => {
  const client = getClient();
  const res = await client.connect("chatChannel", { channelId: "room-1" }, { password: "wrong" });

  expect(res.success).toBe(false);
  expect(res.error?.message).toBe("Wrong password");
  expect(res.error?.fault).toBe("client");
});

test("channel: subscriber receives message sent by another client", async () => {
  const subscriber = getClient();
  const sender = getClient();
  const params = { channelId: "room-1" };

  const subConn = await subscriber.connect("chatChannel", params, { password: "open-sesame" });
  expect(subConn.success).toBe(true);

  let resolveMessage: (msg: unknown) => void;
  const messageReceived = new Promise((resolve) => { resolveMessage = resolve; });

  const unsubscribe = await subscriber.subscribe("chatChannel", params, subConn.token!, (msg) => {
    resolveMessage(msg);
  });

  const sendConn = await sender.connect("chatChannel", params, { password: "open-sesame" });
  expect(sendConn.success).toBe(true);

  await sender.send("chatChannel", params, sendConn.token!, { content: "hello from sender" });

  const received = await Promise.race([
    messageReceived,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 3000),
    ),
  ]);

  expect((received as any).content).toBe("hello from sender");
  unsubscribe();
});

test("listen: client refetches when a resource is invalidated", async () => {
  const aClient = getClient();
  const bClient = getClient();

  let callCount = 0;
  let resolveUpdate: () => void;
  const updateReceived = new Promise<void>((resolve) => { resolveUpdate = resolve; });

  const unlisten = aClient.listen(
    "hello",
    { name: "Alice" },
    () => {
      callCount++;
      if (callCount >= 2) resolveUpdate();
    },
    true,
  );

  await new Promise((resolve) => setTimeout(resolve, 200));
  await bClient.mutate("update", { name: "Alice" });

  await Promise.race([
    updateReceived,
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 3000),
    ),
  ]);

  expect(callCount).toBeGreaterThanOrEqual(2);
  unlisten();
});
