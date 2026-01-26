import { z } from "zod";
import { test, expect } from "bun:test";
import { declareCovenant, channel } from "@covenant/core";
import { CovenantServer } from "../lib/server";
import { CovenantClient } from "@covenant/client";
import { directClientToServer } from "../lib/interfaces/direct";
import { InternalSidekick } from "../../sidekick/internal";

test("basic channel connection", async () => {
  const sidekick = new InternalSidekick();

  const covenant = declareCovenant({
    procedures: {},
    channels: {
      chat: channel({
        clientMessage: z.object({
          text: z.string(),
        }),
        serverMessage: z.object({
          text: z.string(),
          timestamp: z.number(),
        }),
        connectionRequest: z.object({
          username: z.string(),
        }),
        connectionContext: z.object({
          userId: z.string(),
        }),
        params: ["roomId"],
      }),
    },
  });

  const server = new CovenantServer(covenant, {
    contextGenerator: () => undefined,
    derivation: () => {},
    sidekickConnection: sidekick.getConnectionFromServer(),
  });

  sidekick.setServerCallback((channelName, params, data, context) =>
    server.processChannelMessage(channelName, params, data, context)
  );

  server.defineChannel("chat", {
    onConnect: ({ inputs, params }) => {
      expect(inputs.username).toBe("Alice");
      expect(params.roomId).toBe("room1");
      return {
        userId: `user-${inputs.username}`,
      };
    },
    onMessage: ({ inputs, params, context }) => {
      expect(inputs).toBeDefined();
      expect(params.roomId).toBe("room1");
      expect(context.userId).toBe("user-Alice");
    },
  });

  server.assertAllDefined();

  const client = new CovenantClient(covenant, {
    sidekickConnection: sidekick.getConnectionFromClient(),
    serverConnection: directClientToServer(server, {}),
  });

  // Connect to the channel
  const result = await client.connect("chat", { roomId: "room1" }, {
    username: "Alice",
  });

  expect(result.success).toBe(true);
  expect(result.error).toBe(null);
  if (result.success) {
    expect(result.token).toBeDefined();
  }
});

test("client sending messages through channel", async () => {
  const sidekick = new InternalSidekick();
  const receivedMessages: Array<{ text: string; userId: string }> = [];

  const covenant = declareCovenant({
    procedures: {},
    channels: {
      chat: channel({
        clientMessage: z.object({
          text: z.string(),
        }),
        serverMessage: z.object({
          text: z.string(),
        }),
        connectionRequest: z.object({
          username: z.string(),
        }),
        connectionContext: z.object({
          userId: z.string(),
        }),
        params: ["roomId"],
      }),
    },
  });

  const server = new CovenantServer(covenant, {
    contextGenerator: () => undefined,
    derivation: () => {},
    sidekickConnection: sidekick.getConnectionFromServer(),
  });

  sidekick.setServerCallback((channelName, params, data, context) =>
    server.processChannelMessage(channelName, params, data, context)
  );

  server.defineChannel("chat", {
    onConnect: ({ inputs }) => {
      return {
        userId: `user-${inputs.username}`,
      };
    },
    onMessage: ({ inputs, context }) => {
      receivedMessages.push({
        text: inputs.text,
        userId: context.userId,
      });
    },
  });

  server.assertAllDefined();

  const client = new CovenantClient(covenant, {
    sidekickConnection: sidekick.getConnectionFromClient(),
    serverConnection: directClientToServer(server, {}),
  });

  const result = await client.connect("chat", { roomId: "room1" }, {
    username: "Bob",
  });

  expect(result.success).toBe(true);
  if (!result.success) return;

  // Send a message
  await client.send("chat", { roomId: "room1" }, result.token, {
    text: "Hello, world!",
  });

  // Wait for message to be processed
  await new Promise(resolve => setTimeout(resolve, 50));

  expect(receivedMessages).toEqual([
    {
      text: "Hello, world!",
      userId: "user-Bob",
    },
  ]);
});

test("server sending messages to client", async () => {
  const sidekick = new InternalSidekick();
  const receivedMessages: Array<{ text: string }> = [];

  const covenant = declareCovenant({
    procedures: {},
    channels: {
      notifications: channel({
        clientMessage: z.null(),
        serverMessage: z.object({
          text: z.string(),
        }),
        connectionRequest: z.object({
          userId: z.string(),
        }),
        connectionContext: z.object({
          userId: z.string(),
        }),
        params: [],
      }),
    },
  });

  const server = new CovenantServer(covenant, {
    contextGenerator: () => undefined,
    derivation: () => {},
    sidekickConnection: sidekick.getConnectionFromServer(),
  });

  sidekick.setServerCallback((channelName, params, data, context) =>
    server.processChannelMessage(channelName, params, data, context)
  );

  server.defineChannel("notifications", {
    onConnect: ({ inputs }) => {
      return {
        userId: inputs.userId,
      };
    },
    onMessage: () => {},
  });

  server.assertAllDefined();

  const client = new CovenantClient(covenant, {
    sidekickConnection: sidekick.getConnectionFromClient(),
    serverConnection: directClientToServer(server, {}),
  });

  const result = await client.connect("notifications", {}, {
    userId: "user123",
  });

  expect(result.success).toBe(true);
  if (!result.success) return;

  // Subscribe to receive messages
  const unsubscribe = await client.subscribe(
    "notifications",
    {},
    result.token,
    (message) => {
      receivedMessages.push(message);
    }
  );

  // Wait for subscription to be established
  await new Promise(resolve => setTimeout(resolve, 50));

  // Server sends a message
  await server.postChannelMessage("notifications", {}, {
    text: "New notification!",
  });

  // Wait for message to propagate
  await new Promise(resolve => setTimeout(resolve, 50));

  expect(receivedMessages).toEqual([
    {
      text: "New notification!",
    },
  ]);

  unsubscribe();
});

test("bidirectional channel communication", async () => {
  const sidekick = new InternalSidekick();
  const serverReceivedMessages: string[] = [];
  const clientReceivedMessages: string[] = [];

  const covenant = declareCovenant({
    procedures: {},
    channels: {
      chat: channel({
        clientMessage: z.object({
          text: z.string(),
        }),
        serverMessage: z.object({
          text: z.string(),
          from: z.string(),
        }),
        connectionRequest: z.object({
          username: z.string(),
        }),
        connectionContext: z.object({
          username: z.string(),
        }),
        params: ["roomId"],
      }),
    },
  });

  const server = new CovenantServer(covenant, {
    contextGenerator: () => undefined,
    derivation: () => {},
    sidekickConnection: sidekick.getConnectionFromServer(),
  });

  sidekick.setServerCallback((channelName, params, data, context) =>
    server.processChannelMessage(channelName, params, data, context)
  );

  server.defineChannel("chat", {
    onConnect: ({ inputs }) => {
      return {
        username: inputs.username,
      };
    },
    onMessage: async ({ inputs, params, context }) => {
      serverReceivedMessages.push(inputs.text);

      // Echo the message back
      await server.postChannelMessage("chat", params, {
        text: inputs.text,
        from: context.username,
      });
    },
  });

  server.assertAllDefined();

  const client = new CovenantClient(covenant, {
    sidekickConnection: sidekick.getConnectionFromClient(),
    serverConnection: directClientToServer(server, {}),
  });

  const result = await client.connect("chat", { roomId: "general" }, {
    username: "Charlie",
  });

  expect(result.success).toBe(true);
  if (!result.success) return;

  // Subscribe to receive echoed messages
  const unsubscribe = await client.subscribe(
    "chat",
    { roomId: "general" },
    result.token,
    (message) => {
      clientReceivedMessages.push(`${message.from}: ${message.text}`);
    }
  );

  await new Promise(resolve => setTimeout(resolve, 50));

  // Send a message
  await client.send("chat", { roomId: "general" }, result.token, {
    text: "Hello from client!",
  });

  // Wait for round trip
  await new Promise(resolve => setTimeout(resolve, 100));

  expect(serverReceivedMessages).toEqual(["Hello from client!"]);
  expect(clientReceivedMessages).toEqual(["Charlie: Hello from client!"]);

  unsubscribe();
});

test("multiple clients on same channel", async () => {
  const sidekick = new InternalSidekick();

  const covenant = declareCovenant({
    procedures: {},
    channels: {
      broadcast: channel({
        clientMessage: z.null(),
        serverMessage: z.object({
          announcement: z.string(),
        }),
        connectionRequest: z.object({
          name: z.string(),
        }),
        connectionContext: z.object({
          name: z.string(),
        }),
        params: [],
      }),
    },
  });

  const server = new CovenantServer(covenant, {
    contextGenerator: () => undefined,
    derivation: () => {},
    sidekickConnection: sidekick.getConnectionFromServer(),
  });

  sidekick.setServerCallback((channelName, params, data, context) =>
    server.processChannelMessage(channelName, params, data, context)
  );

  server.defineChannel("broadcast", {
    onConnect: ({ inputs }) => {
      return { name: inputs.name };
    },
    onMessage: () => {},
  });

  server.assertAllDefined();

  // Create two clients
  const client1 = new CovenantClient(covenant, {
    sidekickConnection: sidekick.getConnectionFromClient(),
    serverConnection: directClientToServer(server, {}),
  });

  const client2 = new CovenantClient(covenant, {
    sidekickConnection: sidekick.getConnectionFromClient(),
    serverConnection: directClientToServer(server, {}),
  });

  const result1 = await client1.connect("broadcast", {}, { name: "Client1" });
  const result2 = await client2.connect("broadcast", {}, { name: "Client2" });

  expect(result1.success).toBe(true);
  expect(result2.success).toBe(true);
  if (!result1.success || !result2.success) return;

  const messages1: string[] = [];
  const messages2: string[] = [];

  const unsub1 = await client1.subscribe("broadcast", {}, result1.token, (msg) => {
    messages1.push(msg.announcement);
  });

  const unsub2 = await client2.subscribe("broadcast", {}, result2.token, (msg) => {
    messages2.push(msg.announcement);
  });

  await new Promise(resolve => setTimeout(resolve, 50));

  // Server broadcasts to all clients
  await server.postChannelMessage("broadcast", {}, {
    announcement: "System update!",
  });

  await new Promise(resolve => setTimeout(resolve, 50));

  // Both clients should receive the message
  expect(messages1).toEqual(["System update!"]);
  expect(messages2).toEqual(["System update!"]);

  unsub1();
  unsub2();
});

test("channel connection error handling", async () => {
  const sidekick = new InternalSidekick();

  const covenant = declareCovenant({
    procedures: {},
    channels: {
      restricted: channel({
        clientMessage: z.null(),
        serverMessage: z.null(),
        connectionRequest: z.object({
          password: z.string(),
        }),
        connectionContext: z.object({
          authenticated: z.boolean(),
        }),
        params: [],
      }),
    },
  });

  const server = new CovenantServer(covenant, {
    contextGenerator: () => undefined,
    derivation: () => {},
    sidekickConnection: sidekick.getConnectionFromServer(),
  });

  sidekick.setServerCallback((channelName, params, data, context) =>
    server.processChannelMessage(channelName, params, data, context)
  );

  server.defineChannel("restricted", {
    onConnect: ({ inputs, reject }) => {
      if (inputs.password !== "secret") {
        reject("Invalid password", "client");
      }
      return { authenticated: true };
    },
    onMessage: () => {},
  });

  server.assertAllDefined();

  const client = new CovenantClient(covenant, {
    sidekickConnection: sidekick.getConnectionFromClient(),
    serverConnection: directClientToServer(server, {}),
  });

  // Try to connect with wrong password
  const result = await client.connect("restricted", {}, {
    password: "wrong",
  });

  expect(result.success).toBe(false);
  expect(result.error).toBeDefined();
  if (!result.success) {
    expect(result.error.message).toBe("Invalid password");
    expect(result.error.fault).toBe("client");
  }
});

test("channel message error handling", async () => {
  const sidekick = new InternalSidekick();

  const covenant = declareCovenant({
    procedures: {},
    channels: {
      moderated: channel({
        clientMessage: z.object({
          text: z.string(),
        }),
        serverMessage: z.null(),
        connectionRequest: z.object({
          username: z.string(),
        }),
        connectionContext: z.object({
          username: z.string(),
        }),
        params: [],
      }),
    },
  });

  const server = new CovenantServer(covenant, {
    contextGenerator: () => undefined,
    derivation: () => {},
    sidekickConnection: sidekick.getConnectionFromServer(),
  });

  sidekick.setServerCallback((channelName, params, data, context) =>
    server.processChannelMessage(channelName, params, data, context)
  );

  server.defineChannel("moderated", {
    onConnect: ({ inputs }) => {
      return { username: inputs.username };
    },
    onMessage: ({ inputs, error }) => {
      if (inputs.text.includes("banned")) {
        error("Message contains banned words", "client");
      }
    },
  });

  server.assertAllDefined();

  const client = new CovenantClient(covenant, {
    sidekickConnection: sidekick.getConnectionFromClient(),
    serverConnection: directClientToServer(server, {}),
  });

  const result = await client.connect("moderated", {}, {
    username: "User1",
  });

  expect(result.success).toBe(true);
  if (!result.success) return;

  // Try to send a message with banned content
  try {
    await client.send("moderated", {}, result.token, {
      text: "This is banned content",
    });
    expect(true).toBe(false); // Should not reach here
  } catch (error: any) {
    expect(error.message).toContain("banned words");
  }
});

test("channel with multiple params", async () => {
  const sidekick = new InternalSidekick();

  const covenant = declareCovenant({
    procedures: {},
    channels: {
      thread: channel({
        clientMessage: z.object({
          text: z.string(),
        }),
        serverMessage: z.object({
          text: z.string(),
        }),
        connectionRequest: z.null(),
        connectionContext: z.object({
          connected: z.boolean(),
        }),
        params: ["forumId", "threadId"],
      }),
    },
  });

  const server = new CovenantServer(covenant, {
    contextGenerator: () => undefined,
    derivation: () => {},
    sidekickConnection: sidekick.getConnectionFromServer(),
  });

  sidekick.setServerCallback((channelName, params, data, context) =>
    server.processChannelMessage(channelName, params, data, context)
  );

  server.defineChannel("thread", {
    onConnect: ({ params }) => {
      expect(params.forumId).toBe("tech");
      expect(params.threadId).toBe("123");
      return { connected: true };
    },
    onMessage: ({ params }) => {
      expect(params.forumId).toBe("tech");
      expect(params.threadId).toBe("123");
    },
  });

  server.assertAllDefined();

  const client = new CovenantClient(covenant, {
    sidekickConnection: sidekick.getConnectionFromClient(),
    serverConnection: directClientToServer(server, {}),
  });

  const result = await client.connect(
    "thread",
    { forumId: "tech", threadId: "123" },
    null
  );

  expect(result.success).toBe(true);
  if (!result.success) return;

  await client.send(
    "thread",
    { forumId: "tech", threadId: "123" },
    result.token,
    { text: "Test message" }
  );

  await new Promise(resolve => setTimeout(resolve, 50));
});

test("channel unsubscribe", async () => {
  const sidekick = new InternalSidekick();
  const receivedMessages: string[] = [];

  const covenant = declareCovenant({
    procedures: {},
    channels: {
      updates: channel({
        clientMessage: z.null(),
        serverMessage: z.object({
          update: z.string(),
        }),
        connectionRequest: z.null(),
        connectionContext: z.null(),
        params: [],
      }),
    },
  });

  const server = new CovenantServer(covenant, {
    contextGenerator: () => undefined,
    derivation: () => {},
    sidekickConnection: sidekick.getConnectionFromServer(),
  });

  sidekick.setServerCallback((channelName, params, data, context) =>
    server.processChannelMessage(channelName, params, data, context)
  );

  server.defineChannel("updates", {
    onConnect: () => null,
    onMessage: () => {},
  });

  server.assertAllDefined();

  const client = new CovenantClient(covenant, {
    sidekickConnection: sidekick.getConnectionFromClient(),
    serverConnection: directClientToServer(server, {}),
  });

  const result = await client.connect("updates", {}, null);
  expect(result.success).toBe(true);
  if (!result.success) return;

  const unsubscribe = await client.subscribe("updates", {}, result.token, (msg) => {
    receivedMessages.push(msg.update);
  });

  await new Promise(resolve => setTimeout(resolve, 50));

  // Send first message
  await server.postChannelMessage("updates", {}, { update: "Update 1" });
  await new Promise(resolve => setTimeout(resolve, 50));

  expect(receivedMessages).toEqual(["Update 1"]);

  // Unsubscribe
  unsubscribe();
  await new Promise(resolve => setTimeout(resolve, 50));

  // Send second message - should not be received
  await server.postChannelMessage("updates", {}, { update: "Update 2" });
  await new Promise(resolve => setTimeout(resolve, 50));

  // Should still only have the first message
  expect(receivedMessages).toEqual(["Update 1"]);
});
