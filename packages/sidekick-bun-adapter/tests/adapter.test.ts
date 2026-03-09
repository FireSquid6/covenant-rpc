import { test, expect } from "bun:test";
import ION from "@covenant-rpc/ion";
import { bunSidekickAdapter } from "../index";
import type { SidekickOutgoingMessage } from "@covenant-rpc/core/sidekick/protocol";

// Test Helpers

interface TestServer {
  port: number;
  basePath: string;
  url: string;
  close: () => void;
}

function startTestServer(secret: string, basePath: string = ""): TestServer {
  const adapter = bunSidekickAdapter({
    secret,
    serverConnection: { sendMessage: async () => null },
    authFailureDelayMs: 0,
  });

  const port = 10000 + Math.floor(Math.random() * 50000);

  const server = Bun.serve({
    port,
    fetch(req, server) {
      return adapter.fetch(req, server, basePath) as any;
    },
    websocket: adapter.websocket,
  });

  return {
    port,
    basePath,
    url: `http://localhost:${port}`,
    close: () => server.stop(),
  };
}

async function connectWs(port: number, basePath: string = ""): Promise<WebSocket> {
  const ws = new WebSocket(`ws://localhost:${port}${basePath}/socket`);

  await new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", () => reject(new Error("WebSocket connection failed")));
  });

  return ws;
}

async function sendWsAndWaitForReply(ws: WebSocket, message: unknown): Promise<SidekickOutgoingMessage> {
  const encoded = ION.stringify(message);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout waiting for WebSocket reply"));
    }, 5000);

    const handler = (event: MessageEvent) => {
      clearTimeout(timeout);
      try {
        const parsed = ION.parse(event.data.toString()) as SidekickOutgoingMessage;
        ws.removeEventListener("message", handler);
        resolve(parsed);
      } catch (err) {
        ws.removeEventListener("message", handler);
        reject(err);
      }
    };

    ws.addEventListener("message", handler);
    ws.send(encoded);
  });
}

function postEndpoint(
  server: TestServer,
  path: string,
  body: unknown,
  secret: string,
  useION: boolean = false,
): Promise<Response> {
  return fetch(`${server.url}${server.basePath}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${secret}`,
      "Content-Type": useION ? "application/ion" : "application/json",
    },
    body: useION ? ION.stringify(body) : JSON.stringify(body),
  });
}

// HTTP Endpoint Tests

test("HTTP: auth rejection - POST /resources without correct Bearer token returns 401", async () => {
  const server = startTestServer("test-secret");

  try {
    const response = await fetch(`${server.url}/resources`, {
      method: "POST",
      headers: { "Authorization": "Bearer wrong-secret" },
      body: JSON.stringify({ resources: ["a"] }),
    });

    expect(response.status).toBe(401);
  } finally {
    server.close();
  }
});

test("HTTP: POST /resources with correct auth returns 200", async () => {
  const secret = "test-secret-resources";
  const server = startTestServer(secret);

  try {
    const response = await postEndpoint(server, "/resources", { resources: ["a", "b"] }, secret, false);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
  } finally {
    server.close();
  }
});

test("HTTP: POST /connection with ION-encoded payload returns 200", async () => {
  const secret = "test-secret-connection";
  const server = startTestServer(secret);

  try {
    const payload = {
      token: "test-token-123",
      channel: "test-channel",
      params: { room: "general" },
      context: { userId: "user1" },
    };

    const response = await postEndpoint(server, "/connection", payload, secret, true);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
  } finally {
    server.close();
  }
});

test("HTTP: POST /message with ION-encoded ServerMessage returns 200", async () => {
  const secret = "test-secret-message";
  const server = startTestServer(secret);

  try {
    const message = {
      channel: "chat",
      params: { room: "lobby" },
      data: { text: "Hello, world!" },
    };

    const response = await postEndpoint(server, "/message", message, secret, true);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
  } finally {
    server.close();
  }
});

test("HTTP: 404 for unknown routes", async () => {
  const secret = "test-secret-404";
  const server = startTestServer(secret);

  try {
    const getResponse = await fetch(`${server.url}/unknown`, { method: "GET" });
    expect(getResponse.status).toBe(404);

    const postResponse = await fetch(`${server.url}/unknown`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${secret}` },
    });
    expect(postResponse.status).toBe(404);
  } finally {
    server.close();
  }
});

// WebSocket Tests

test("WS: client can connect on /socket", async () => {
  const server = startTestServer("test-secret-ws");

  try {
    const ws = await connectWs(server.port);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  } finally {
    server.close();
  }
});

test("WS: listen/unlisten flow", async () => {
  const server = startTestServer("test-secret-listen");

  try {
    const ws = await connectWs(server.port);

    const listenResponse = await sendWsAndWaitForReply(ws, {
      type: "listen",
      resources: ["r1"],
    });

    expect(listenResponse).toEqual({ type: "listening", resources: ["r1"] });

    const unlistenResponse = await sendWsAndWaitForReply(ws, {
      type: "unlisten",
      resources: ["r1"],
    });

    expect(unlistenResponse).toEqual({ type: "unlistening", resources: ["r1"] });

    ws.close();
  } finally {
    server.close();
  }
});

test("WS: resource update broadcast", async () => {
  const secret = "test-secret-broadcast";
  const server = startTestServer(secret);

  try {
    const ws = await connectWs(server.port);

    await sendWsAndWaitForReply(ws, { type: "listen", resources: ["x"] });

    const updatePromise = new Promise<SidekickOutgoingMessage>((resolve) => {
      const handler = (event: MessageEvent) => {
        ws.removeEventListener("message", handler);
        resolve(ION.parse(event.data.toString()) as SidekickOutgoingMessage);
      };
      ws.addEventListener("message", handler);
    });

    await postEndpoint(server, "/resources", { resources: ["x"] }, secret, false);

    const update = await updatePromise;
    expect(update).toEqual({ type: "updated", resource: "x" });

    ws.close();
  } finally {
    server.close();
  }
});

test("WS: subscribe/unsubscribe flow", async () => {
  const secret = "test-secret-subscribe";
  const server = startTestServer(secret);

  try {
    const ws = await connectWs(server.port);

    const token = "subscribe-token-123";
    const channel = "chat";
    const params = { room: "general" };

    await postEndpoint(server, "/connection", { token, channel, params, context: {} }, secret, true);

    const subscribeResponse = await sendWsAndWaitForReply(ws, { type: "subscribe", token });
    expect(subscribeResponse).toEqual({ type: "subscribed", channel, params });

    const unsubscribeResponse = await sendWsAndWaitForReply(ws, { type: "unsubscribe", token });
    expect(unsubscribeResponse).toEqual({ type: "unsubscribed", channel, params });

    ws.close();
  } finally {
    server.close();
  }
});

test("WS: channel message broadcast", async () => {
  const secret = "test-secret-channel-msg";
  const server = startTestServer(secret);

  try {
    const ws = await connectWs(server.port);

    const token = "channel-msg-token-456";
    const channel = "notifications";
    const params = { userId: "user123" };

    await postEndpoint(server, "/connection", { token, channel, params, context: {} }, secret, true);
    await sendWsAndWaitForReply(ws, { type: "subscribe", token });

    const messagePromise = new Promise<SidekickOutgoingMessage>((resolve) => {
      const handler = (event: MessageEvent) => {
        ws.removeEventListener("message", handler);
        resolve(ION.parse(event.data.toString()) as SidekickOutgoingMessage);
      };
      ws.addEventListener("message", handler);
    });

    const messageData = { text: "New notification!" };
    await postEndpoint(server, "/message", { channel, params, data: messageData }, secret, true);

    const message = await messagePromise;
    expect(message).toEqual({ type: "message", channel, params, data: messageData });

    ws.close();
  } finally {
    server.close();
  }
});

test("WS: invalid message returns error with fault: client", async () => {
  const server = startTestServer("test-secret-invalid");

  try {
    const ws = await connectWs(server.port);

    const errorPromise = new Promise<SidekickOutgoingMessage>((resolve) => {
      ws.addEventListener("message", (event) => {
        resolve(ION.parse(event.data.toString()) as SidekickOutgoingMessage);
      }, { once: true });
    });

    ws.send("not valid ION at all!");

    const error = await errorPromise;
    expect(error.type).toBe("error");
    if (error.type === "error") {
      expect(error.error.fault).toBe("client");
    }

    ws.close();
  } finally {
    server.close();
  }
});

// basePath Tests

test("basePath: routes are correctly stripped when mounted at /sidekick", async () => {
  const secret = "test-secret-basepath";
  const server = startTestServer(secret, "/sidekick");

  try {
    // Should work at /sidekick/resources
    const response = await postEndpoint(server, "/resources", { resources: ["a"] }, secret, false);
    expect(response.status).toBe(200);

    // Should 404 at bare /resources (wrong prefix)
    const bareResponse = await fetch(`${server.url}/resources`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${secret}` },
      body: JSON.stringify({ resources: ["a"] }),
    });
    expect(bareResponse.status).toBe(404);
  } finally {
    server.close();
  }
});

test("basePath: WebSocket connects at /sidekick/socket", async () => {
  const server = startTestServer("test-secret-basepath-ws", "/sidekick");

  try {
    const ws = await connectWs(server.port, "/sidekick");
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  } finally {
    server.close();
  }
});
