import { test, expect } from "bun:test";
import { WebSocket } from "ws";
import ION from "@covenant-rpc/ion";
import { startSidekickServer } from "../sidekick/webserver";
import type { Server } from "node:http";
import type { SidekickOutgoingMessage } from "@covenant-rpc/core/sidekick/protocol";

// Test Helpers

interface TestServer {
  server: Server;
  port: number;
  url: string;
  close: () => Promise<void>;
}

async function startTestServer(secret: string): Promise<TestServer> {
  const port = 10000 + Math.floor(Math.random() * 50000);
  const server = startSidekickServer({
    port,
    secret,
    authFailureDelayMs: 0, // No delay for tests
    serverConnection: { sendMessage: async () => null },
  });

  // Wait for server to be ready
  await new Promise<void>((resolve) => {
    server.once("listening", () => resolve());
  });

  return {
    server,
    port,
    url: `http://localhost:${port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}

async function connectWs(port: number): Promise<WebSocket> {
  const ws = new WebSocket(`ws://localhost:${port}/socket`);

  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });

  return ws;
}

async function sendWsAndWaitForReply(ws: WebSocket, message: unknown): Promise<SidekickOutgoingMessage> {
  const encoded = ION.stringify(message);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout waiting for WebSocket reply"));
    }, 5000);

    const handler = (data: any) => {
      clearTimeout(timeout);
      try {
        const parsed = ION.parse(data.toString()) as SidekickOutgoingMessage;
        ws.off("message", handler);
        resolve(parsed);
      } catch (err) {
        ws.off("message", handler);
        reject(err);
      }
    };

    ws.on("message", handler);
    ws.send(encoded);
  });
}

async function postEndpoint(
  port: number,
  path: string,
  body: unknown,
  secret: string,
  useION: boolean = false
): Promise<Response> {
  const url = `http://localhost:${port}${path}`;
  const encodedBody = useION ? ION.stringify(body) : JSON.stringify(body);

  return fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${secret}`,
      "Content-Type": useION ? "application/ion" : "application/json",
    },
    body: encodedBody,
  });
}

// HTTP Endpoint Tests

test("HTTP: auth rejection - POST /resources without correct Bearer token returns 401", async () => {
  const server = await startTestServer("test-secret");

  try {
    const response = await fetch(`${server.url}/resources`, {
      method: "POST",
      headers: {
        "Authorization": "Bearer wrong-secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ resources: ["a"] }),
    });

    expect(response.status).toBe(401);
  } finally {
    await server.close();
  }
});

test("HTTP: POST /resources with correct auth returns 200", async () => {
  const secret = "test-secret-resources";
  const server = await startTestServer(secret);

  try {
    const response = await postEndpoint(
      server.port,
      "/resources",
      { resources: ["a", "b"] },
      secret,
      false
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
  } finally {
    await server.close();
  }
});

test("HTTP: POST /connection with ION-encoded payload returns 200", async () => {
  const secret = "test-secret-connection";
  const server = await startTestServer(secret);

  try {
    const payload = {
      token: "test-token-123",
      channel: "test-channel",
      params: { room: "general" },
      context: { userId: "user1" },
    };

    const response = await postEndpoint(
      server.port,
      "/connection",
      payload,
      secret,
      true
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
  } finally {
    await server.close();
  }
});

test("HTTP: POST /message with ION-encoded ServerMessage returns 200", async () => {
  const secret = "test-secret-message";
  const server = await startTestServer(secret);

  try {
    const message = {
      channel: "chat",
      params: { room: "lobby" },
      data: { text: "Hello, world!" },
    };

    const response = await postEndpoint(
      server.port,
      "/message",
      message,
      secret,
      true
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
  } finally {
    await server.close();
  }
});

test("HTTP: 404 for unknown routes", async () => {
  const secret = "test-secret-404";
  const server = await startTestServer(secret);

  try {
    // GET request should return 404
    const getResponse = await fetch(`${server.url}/unknown`, {
      method: "GET",
    });
    expect(getResponse.status).toBe(404);

    // POST to unknown path should return 404
    const postResponse = await fetch(`${server.url}/unknown`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${secret}` },
    });
    expect(postResponse.status).toBe(404);
  } finally {
    await server.close();
  }
});

// WebSocket Tests

test("WS: client can connect on /socket", async () => {
  const server = await startTestServer("test-secret-ws");

  try {
    const ws = await connectWs(server.port);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  } finally {
    await server.close();
  }
});

test("WS: connection rejected on wrong path", async () => {
  const server = await startTestServer("test-secret-ws-path");

  try {
    const ws = new WebSocket(`ws://localhost:${server.port}/other`);

    // Should be closed/errored, not open
    await new Promise<void>((resolve) => {
      ws.once("close", () => resolve());
      ws.once("error", () => resolve());
      setTimeout(() => resolve(), 1000);
    });

    expect(ws.readyState).not.toBe(WebSocket.OPEN);
  } finally {
    await server.close();
  }
});

test("WS: listen/unlisten flow", async () => {
  const server = await startTestServer("test-secret-listen");

  try {
    const ws = await connectWs(server.port);

    // Send listen message
    const listenResponse = await sendWsAndWaitForReply(ws, {
      type: "listen",
      resources: ["r1"],
    });

    expect(listenResponse).toEqual({
      type: "listening",
      resources: ["r1"],
    });

    // Send unlisten message
    const unlistenResponse = await sendWsAndWaitForReply(ws, {
      type: "unlisten",
      resources: ["r1"],
    });

    expect(unlistenResponse).toEqual({
      type: "unlistening",
      resources: ["r1"],
    });

    ws.close();
  } finally {
    await server.close();
  }
});

test("WS: resource update broadcast", async () => {
  const secret = "test-secret-broadcast";
  const server = await startTestServer(secret);

  try {
    const ws = await connectWs(server.port);

    // Listen to resource "x"
    await sendWsAndWaitForReply(ws, {
      type: "listen",
      resources: ["x"],
    });

    // Set up listener for the update BEFORE posting
    const updatePromise = new Promise<SidekickOutgoingMessage>((resolve) => {
      const handler = (data: any) => {
        const parsed = ION.parse(data.toString()) as SidekickOutgoingMessage;
        ws.off("message", handler);
        resolve(parsed);
      };
      ws.on("message", handler);
    });

    // Small delay to ensure listener is ready
    await new Promise(resolve => setTimeout(resolve, 10));

    // POST resource update
    await postEndpoint(
      server.port,
      "/resources",
      { resources: ["x"] },
      secret,
      false
    );

    const update = await updatePromise;
    expect(update).toEqual({
      type: "updated",
      resource: "x",
    });

    ws.close();
  } finally {
    await server.close();
  }
});

test("WS: subscribe/unsubscribe flow", async () => {
  const secret = "test-secret-subscribe";
  const server = await startTestServer(secret);

  try {
    const ws = await connectWs(server.port);

    const token = "subscribe-token-123";
    const channel = "chat";
    const params = { room: "general" };

    // Register connection first
    await postEndpoint(
      server.port,
      "/connection",
      { token, channel, params, context: {} },
      secret,
      true
    );

    // Subscribe
    const subscribeResponse = await sendWsAndWaitForReply(ws, {
      type: "subscribe",
      token,
    });

    expect(subscribeResponse).toEqual({
      type: "subscribed",
      channel,
      params,
    });

    // Unsubscribe
    const unsubscribeResponse = await sendWsAndWaitForReply(ws, {
      type: "unsubscribe",
      token,
    });

    expect(unsubscribeResponse).toEqual({
      type: "unsubscribed",
      channel,
      params,
    });

    ws.close();
  } finally {
    await server.close();
  }
});

test("WS: channel message broadcast", async () => {
  const secret = "test-secret-channel-msg";
  const server = await startTestServer(secret);

  try {
    const ws = await connectWs(server.port);

    const token = "channel-msg-token-456";
    const channel = "notifications";
    const params = { userId: "user123" };

    // Register connection
    await postEndpoint(
      server.port,
      "/connection",
      { token, channel, params, context: {} },
      secret,
      true
    );

    // Subscribe to channel
    await sendWsAndWaitForReply(ws, {
      type: "subscribe",
      token,
    });

    // Set up listener for the broadcast BEFORE posting
    const messagePromise = new Promise<SidekickOutgoingMessage>((resolve) => {
      const handler = (data: any) => {
        const parsed = ION.parse(data.toString()) as SidekickOutgoingMessage;
        ws.off("message", handler);
        resolve(parsed);
      };
      ws.on("message", handler);
    });

    // Small delay to ensure listener is ready
    await new Promise(resolve => setTimeout(resolve, 10));

    // POST channel message
    const messageData = { text: "New notification!" };
    await postEndpoint(
      server.port,
      "/message",
      { channel, params, data: messageData },
      secret,
      true
    );

    const message = await messagePromise;
    expect(message).toEqual({
      type: "message",
      channel,
      params,
      data: messageData,
    });

    ws.close();
  } finally {
    await server.close();
  }
});

test("WS: invalid message returns error with fault: client", async () => {
  const server = await startTestServer("test-secret-invalid");

  try {
    const ws = await connectWs(server.port);

    // Send malformed ION
    const errorPromise = new Promise<SidekickOutgoingMessage>((resolve) => {
      ws.once("message", (data) => {
        resolve(ION.parse(data.toString()) as SidekickOutgoingMessage);
      });
    });

    ws.send("not valid ION at all!");

    const error = await errorPromise;
    expect(error.type).toBe("error");
    if (error.type === "error") {
      expect(error.error.fault).toBe("client");
    }

    ws.close();
  } finally {
    await server.close();
  }
});
