import { z } from "zod";
import { test, expect } from "bun:test";
import { declareCovenant, channel } from "@covenant/core";
import { CovenantServer } from "../lib/server";
import { CovenantClient } from "@covenant/client";
import { httpClientToServer } from "@covenant/client/interfaces/http";
import { httpServerToSidekick } from "../lib/interfaces/http";
import { InternalSidekick } from "@covenant/sidekick/internal";

// Helper to create a mock HTTP server
async function createMockHttpServer(server: CovenantServer<any, any, any, any>) {
  const handlers = new Map<string, (req: Request) => Promise<Response>>();

  // Add server handler
  handlers.set("server", (req) => server.handle(req));

  const mockFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const requestUrl = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    const urlObj = new URL(requestUrl);
    const type = urlObj.searchParams.get("type");

    const request = new Request(requestUrl, init);

    if (type === "procedure" || type === "connect" || type === "channel") {
      const handler = handlers.get("server");
      if (handler) {
        return await handler(request);
      }
    }

    return new Response("Not Found", { status: 404 });
  };

  // @ts-expect-error - mocking global fetch
  global.fetch = mockFetch;

  return {
    cleanup: () => {
      // @ts-expect-error - restore
      global.fetch = undefined;
    }
  };
}

test("HTTP channel connection request", async () => {
  const sidekick = new InternalSidekick();

  const covenant = declareCovenant({
    procedures: {},
    channels: {
      chat: channel({
        clientMessage: z.object({ text: z.string() }),
        serverMessage: z.object({ text: z.string() }),
        connectionRequest: z.object({ username: z.string() }),
        connectionContext: z.object({ userId: z.string() }),
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
      return { userId: `user-${inputs.username}` };
    },
    onMessage: () => {},
  });

  server.assertAllDefined();

  const mock = await createMockHttpServer(server);

  const client = new CovenantClient(covenant, {
    sidekickConnection: sidekick.getConnectionFromClient(),
    serverConnection: httpClientToServer("http://localhost:3000", {}),
  });

  const result = await client.connect("chat", { roomId: "room1" }, {
    username: "Alice",
  });

  expect(result.success).toBe(true);
  expect(result.error).toBe(null);
  if (result.success) {
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe("string");
  }

  mock.cleanup();
});

test("HTTP channel connection error handling", async () => {
  const sidekick = new InternalSidekick();

  const covenant = declareCovenant({
    procedures: {},
    channels: {
      restricted: channel({
        clientMessage: z.null(),
        serverMessage: z.null(),
        connectionRequest: z.object({ password: z.string() }),
        connectionContext: z.object({ authenticated: z.boolean() }),
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
      if (inputs.password !== "secret123") {
        reject("Invalid password", "client");
      }
      return { authenticated: true };
    },
    onMessage: () => {},
  });

  server.assertAllDefined();

  const mock = await createMockHttpServer(server);

  const client = new CovenantClient(covenant, {
    sidekickConnection: sidekick.getConnectionFromClient(),
    serverConnection: httpClientToServer("http://localhost:3000", {}),
  });

  // Try with wrong password
  const result = await client.connect("restricted", {}, {
    password: "wrong",
  });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBeDefined();
    expect(result.error.message).toBe("Invalid password");
    expect(result.error.fault).toBe("client");
  }

  mock.cleanup();
});

test("HTTP server-to-sidekick message posting", async () => {
  const receivedMessages: any[] = [];

  // Create a mock sidekick HTTP endpoint
  const mockSidekickFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const requestUrl = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    const urlObj = new URL(requestUrl);

    if (urlObj.pathname === "/connection") {
      const body = await (init?.body ? JSON.parse(init.body as string) : {});
      receivedMessages.push({ type: "connection", ...body });
      return new Response(null, { status: 200 });
    }

    if (urlObj.pathname === "/message") {
      const body = await (init?.body ? JSON.parse(init.body as string) : {});
      receivedMessages.push({ type: "message", ...body });
      return new Response(null, { status: 200 });
    }

    if (urlObj.pathname === "/resources") {
      const body = await (init?.body ? JSON.parse(init.body as string) : {});
      receivedMessages.push({ type: "resources", ...body });
      return new Response(null, { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  };

  // @ts-expect-error - mocking global fetch
  global.fetch = mockSidekickFetch;

  const sidekickConnection = httpServerToSidekick("http://localhost:4000", "test-key");

  const covenant = declareCovenant({
    procedures: {},
    channels: {
      notifications: channel({
        clientMessage: z.null(),
        serverMessage: z.object({ text: z.string() }),
        connectionRequest: z.null(),
        connectionContext: z.null(),
        params: [],
      }),
    },
  });

  const server = new CovenantServer(covenant, {
    contextGenerator: () => undefined,
    derivation: () => {},
    sidekickConnection,
  });

  server.defineChannel("notifications", {
    onConnect: () => null,
    onMessage: () => {},
  });

  server.assertAllDefined();

  // Test adding connection
  const connectionError = await sidekickConnection.addConnection({
    token: "test-token-123",
    channel: "notifications",
    params: {},
    context: null,
  });

  expect(connectionError).toBe(null);
  expect(receivedMessages.length).toBe(1);
  expect(receivedMessages[0].type).toBe("connection");
  expect(receivedMessages[0].token).toBe("test-token-123");

  // Test posting message
  const messageError = await sidekickConnection.postMessage({
    channel: "notifications",
    params: {},
    data: { text: "Hello!" },
  });

  expect(messageError).toBe(null);
  expect(receivedMessages.length).toBe(2);
  expect(receivedMessages[1].type).toBe("message");
  expect(receivedMessages[1].data).toEqual({ text: "Hello!" });

  // Test updating resources
  const updateError = await sidekickConnection.update(["resource1", "resource2"]);

  expect(updateError).toBe(null);
  expect(receivedMessages.length).toBe(3);
  expect(receivedMessages[2].type).toBe("resources");
  expect(receivedMessages[2].resources).toEqual(["resource1", "resource2"]);

  // @ts-expect-error - restore
  global.fetch = undefined;
});

test("HTTP channel message from sidekick to server", async () => {
  const receivedMessages: Array<{ text: string; userId: string }> = [];

  const covenant = declareCovenant({
    procedures: {},
    channels: {
      chat: channel({
        clientMessage: z.object({ text: z.string() }),
        serverMessage: z.null(),
        connectionRequest: z.object({ username: z.string() }),
        connectionContext: z.object({ userId: z.string() }),
        params: ["roomId"],
      }),
    },
  });

  const server = new CovenantServer(covenant, {
    contextGenerator: () => undefined,
    derivation: () => {},
    sidekickConnection: httpServerToSidekick("http://localhost:4000", "test-key"),
  });

  server.defineChannel("chat", {
    onConnect: ({ inputs }) => {
      return { userId: `user-${inputs.username}` };
    },
    onMessage: ({ inputs, context }) => {
      receivedMessages.push({
        text: inputs.text,
        userId: context.userId,
      });
    },
  });

  server.assertAllDefined();

  const mock = await createMockHttpServer(server);

  // Simulate sidekick sending a message to the server
  const response = await fetch("http://localhost:3000?type=channel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-key",
    },
    body: JSON.stringify({
      channel: "chat",
      params: { roomId: "general" },
      data: { text: "Hello from sidekick!" },
      context: { userId: "user-Bob" },
    }),
  });

  expect(response.status).toBe(204);
  expect(receivedMessages.length).toBe(1);
  expect(receivedMessages[0]).toEqual({
    text: "Hello from sidekick!",
    userId: "user-Bob",
  });

  mock.cleanup();
});

test("HTTP channel message error handling", async () => {
  const covenant = declareCovenant({
    procedures: {},
    channels: {
      moderated: channel({
        clientMessage: z.object({ text: z.string() }),
        serverMessage: z.null(),
        connectionRequest: z.null(),
        connectionContext: z.null(),
        params: [],
      }),
    },
  });

  const server = new CovenantServer(covenant, {
    contextGenerator: () => undefined,
    derivation: () => {},
    sidekickConnection: httpServerToSidekick("http://localhost:4000", "test-key"),
  });

  server.defineChannel("moderated", {
    onConnect: () => null,
    onMessage: ({ inputs, error }) => {
      if (inputs.text.includes("spam")) {
        error("Message contains spam", "client");
      }
    },
  });

  server.assertAllDefined();

  const mock = await createMockHttpServer(server);

  // Simulate sidekick sending a spam message
  const response = await fetch("http://localhost:3000?type=channel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-key",
    },
    body: JSON.stringify({
      channel: "moderated",
      params: {},
      data: { text: "This is spam content" },
      context: null,
    }),
  });

  expect(response.status).toBe(400);
  const errorBody = await response.json() as any;
  expect(errorBody.fault).toBe("client");
  expect(errorBody.message).toContain("spam");

  mock.cleanup();
});

test("HTTP connection with invalid channel", async () => {
  const sidekick = new InternalSidekick();

  const covenant = declareCovenant({
    procedures: {},
    channels: {
      chat: channel({
        clientMessage: z.null(),
        serverMessage: z.null(),
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

  server.defineChannel("chat", {
    onConnect: () => null,
    onMessage: () => {},
  });

  server.assertAllDefined();

  const mock = await createMockHttpServer(server);

  const client = new CovenantClient(covenant, {
    sidekickConnection: sidekick.getConnectionFromClient(),
    serverConnection: httpClientToServer("http://localhost:3000", {}),
  });

  // Try to connect to a channel that doesn't exist
  // @ts-expect-error - intentionally using wrong channel name
  const result = await client.connect("nonexistent", {}, null);

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBeDefined();
    expect(result.error.fault).toBe("server");
  }

  mock.cleanup();
});

test("HTTP connection with invalid request data", async () => {
  const sidekick = new InternalSidekick();

  const covenant = declareCovenant({
    procedures: {},
    channels: {
      chat: channel({
        clientMessage: z.null(),
        serverMessage: z.null(),
        connectionRequest: z.object({
          username: z.string(),
          email: z.string().email(),
        }),
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

  server.defineChannel("chat", {
    onConnect: () => null,
    onMessage: () => {},
  });

  server.assertAllDefined();

  const mock = await createMockHttpServer(server);

  const client = new CovenantClient(covenant, {
    sidekickConnection: sidekick.getConnectionFromClient(),
    serverConnection: httpClientToServer("http://localhost:3000", {}),
  });

  // Try to connect with invalid email
  const result = await client.connect("chat", {}, {
    username: "Alice",
    email: "not-an-email",
  });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBeDefined();
    expect(result.error.fault).toBe("client");
    expect(result.error.message).toContain("Invalid");
  }

  mock.cleanup();
});
