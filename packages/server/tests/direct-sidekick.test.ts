import { z } from "zod";
import { test, expect } from "bun:test";
import { declareCovenant, channel } from "@covenant-rpc/core";
import { CovenantServer } from "../server";
import { directSidekickToServer } from "../interfaces/direct";
import { emptyServerToSidekick } from "../interfaces/empty";

function makeServer() {
  const covenant = declareCovenant({
    procedures: {},
    channels: {
      chat: channel({
        clientMessage: z.object({ text: z.string() }),
        serverMessage: z.object({ reply: z.string() }),
        connectionRequest: z.null(),
        connectionContext: z.object({ userId: z.string() }),
        params: ["roomId"],
      }),
    },
  });

  const receivedMessages: Array<{ text: string; userId: string }> = [];

  const server = new CovenantServer(covenant, {
    contextGenerator: () => undefined,
    derivation: () => {},
    sidekickConnection: emptyServerToSidekick(),
  });

  server.defineChannel("chat", {
    onConnect: () => ({ userId: "user-1" }),
    onMessage: ({ inputs, context }) => {
      receivedMessages.push({ text: inputs.text, userId: context.userId });
    },
  });

  server.assertAllDefined();

  return { server, receivedMessages };
}

test("sendMessage delivers message to server and returns null on success", async () => {
  const { server, receivedMessages } = makeServer();
  const connection = directSidekickToServer(server);

  // First register a connection so the server knows about the token
  const connectRequest = new Request("http://localhost?type=connect", {
    method: "POST",
    body: JSON.stringify({ channel: "chat", params: { roomId: "room1" }, data: null }),
    headers: { "Content-Type": "application/json" },
  });
  const connectResponse = await server.handle(connectRequest);
  expect(connectResponse.ok).toBe(true);

  const result = await connection.sendMessage({
    channel: "chat",
    params: { roomId: "room1" },
    data: { text: "hello" },
    context: { userId: "user-1" },
  });

  expect(result).toBeNull();
  expect(receivedMessages).toEqual([{ text: "hello", userId: "user-1" }]);
});

test("sendMessage returns a ChannelError when the server returns a non-ok response", async () => {
  const { server } = makeServer();
  const connection = directSidekickToServer(server);

  // Send to a channel that doesn't exist
  const result = await connection.sendMessage({
    channel: "nonexistent",
    params: {},
    data: { text: "hello" },
    context: {},
  });

  expect(result).not.toBeNull();
  expect(result?.channel).toBe("nonexistent");
  expect(result?.fault).toBe("server");
});

test("sendMessage can deliver multiple messages in sequence", async () => {
  const { server, receivedMessages } = makeServer();
  const connection = directSidekickToServer(server);

  const message = {
    channel: "chat",
    params: { roomId: "room1" },
    context: { userId: "user-1" },
  };

  const r1 = await connection.sendMessage({ ...message, data: { text: "first" } });
  const r2 = await connection.sendMessage({ ...message, data: { text: "second" } });
  const r3 = await connection.sendMessage({ ...message, data: { text: "third" } });

  expect(r1).toBeNull();
  expect(r2).toBeNull();
  expect(r3).toBeNull();
  expect(receivedMessages.map(m => m.text)).toEqual(["first", "second", "third"]);
});
