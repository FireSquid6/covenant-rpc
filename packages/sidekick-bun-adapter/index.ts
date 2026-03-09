import type { Server, ServerWebSocket } from "bun";
import { Sidekick, type SidekickClient } from "@covenant-rpc/server";
import type { SidekickToServerConnection } from "@covenant-rpc/core/interfaces";
import { v } from "@covenant-rpc/core/validation";
import { channelConnectionPayload, serverMessageSchema } from "@covenant-rpc/core/channel";
import { sidekickIncomingMessageSchema, type SidekickOutgoingMessage } from "@covenant-rpc/core/sidekick/protocol";
import ION from "@covenant-rpc/ion";

export interface WebSocketData {
  id: string;
  topics: Set<string>;
}

export interface BunSidekickAdapterOptions {
  secret: string;
  serverConnection: SidekickToServerConnection;
  /** Delay in milliseconds before responding to failed auth attempts (default: 3000) */
  authFailureDelayMs?: number;
}

/**
 * Creates a Bun-native Sidekick adapter that can be mounted at a specific route.
 *
 * @example
 * ```ts
 * const sidekick = bunSidekickAdapter({ secret, serverConnection });
 *
 * Bun.serve({
 *   fetch(req, server) {
 *     const url = new URL(req.url);
 *     if (url.pathname.startsWith("/sidekick")) {
 *       return sidekick.fetch(req, server, "/sidekick");
 *     }
 *     return new Response("Not Found", { status: 404 });
 *   },
 *   websocket: sidekick.websocket,
 * });
 * ```
 */
export function bunSidekickAdapter({
  secret,
  serverConnection,
  authFailureDelayMs = 3000,
}: BunSidekickAdapterOptions) {
  const connections = new Set<ServerWebSocket<WebSocketData>>();

  const sidekick = new Sidekick(async (topic, message) => {
    const data = ION.stringify(message);
    for (const conn of connections) {
      if (conn.data.topics.has(topic)) {
        conn.send(data);
      }
    }
  }, serverConnection);

  async function validateKey(req: Request): Promise<boolean> {
    const authorization = req.headers.get("authorization");
    if (authorization !== `Bearer ${secret}`) {
      if (authFailureDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, authFailureDelayMs));
      }
      return false;
    }
    return true;
  }

  async function handleResources(req: Request): Promise<Response> {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
    if (!await validateKey(req)) return new Response("Key didn't match", { status: 401 });

    let parsed: unknown;
    try {
      parsed = JSON.parse(await req.text());
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const result = v.parseSafe(parsed, v.obj({ resources: v.array(v.string()) }));
    if (!result) return new Response("Invalid body schema", { status: 400 });

    await sidekick.updateResources(result.resources);
    return new Response("OK");
  }

  async function handleConnection(req: Request): Promise<Response> {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
    if (!await validateKey(req)) return new Response("Key didn't match", { status: 401 });

    let ionParsed: unknown;
    try {
      ionParsed = ION.parse(await req.text());
    } catch (e) {
      return new Response(`Error parsing ION: ${e}`, { status: 400 });
    }

    const payload = v.parseSafe(ionParsed, channelConnectionPayload);
    if (!payload) return new Response("Did not receive payload in correct schema", { status: 400 });

    sidekick.addConnection(payload);
    return new Response("OK");
  }

  async function handleMessage(req: Request): Promise<Response> {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
    if (!await validateKey(req)) return new Response("Key didn't match", { status: 401 });

    let ionParsed: unknown;
    try {
      ionParsed = ION.parse(await req.text());
    } catch (e) {
      return new Response(`Error parsing ION: ${e}`, { status: 400 });
    }

    const message = v.parseSafe(ionParsed, serverMessageSchema);
    if (!message) return new Response("Did not receive message in correct schema", { status: 400 });

    await sidekick.postServerMessage(message);
    return new Response("OK");
  }

  function handleSocket(req: Request, server: Server<WebSocketData>): Response | undefined {
    const upgraded = server.upgrade(req, {
      data: {
        id: crypto.randomUUID(),
        topics: new Set<string>(),
      },
    });
    if (upgraded) return undefined;
    return new Response("WebSocket upgrade failed", { status: 400 });
  }

  async function fetch(req: Request, server: Server<WebSocketData>, basePath: string = ""): Promise<Response | undefined> {
    const url = new URL(req.url);
    const path = url.pathname.slice(basePath.length) || "/";

    if (path === "/socket") return handleSocket(req, server);
    if (req.method !== "POST") return new Response("Not Found", { status: 404 });
    if (path === "/resources") return handleResources(req);
    if (path === "/connection") return handleConnection(req);
    if (path === "/message") return handleMessage(req);

    return new Response("Not Found", { status: 404 });
  }

  function routes(basePath: string = "") {
    return {
      [`${basePath}/resources`]: handleResources,
      [`${basePath}/connection`]: handleConnection,
      [`${basePath}/message`]: handleMessage,
      [`${basePath}/socket`]: handleSocket,
    };
  }

  const websocket = {
    open(ws: ServerWebSocket<WebSocketData>) {
      connections.add(ws);
    },
    async message(ws: ServerWebSocket<WebSocketData>, raw: string | Buffer) {
      const str = typeof raw === "string" ? raw : raw.toString();

      let parsed: unknown;
      try {
        parsed = ION.parse(str);
      } catch {
        const err: SidekickOutgoingMessage = {
          type: "error",
          error: {
            fault: "client",
            message: "Failed to parse last message as an incoming message. This is a bug in covenant's client code.",
            params: {},
            channel: "unknown",
          },
        };
        ws.send(ION.stringify(err));
        return;
      }

      const message = v.parseSafe(parsed, sidekickIncomingMessageSchema);
      if (message === null) {
        const err: SidekickOutgoingMessage = {
          type: "error",
          error: {
            fault: "client",
            message: "Failed to parse last message as an incoming message. This is a bug in covenant's client code.",
            params: {},
            channel: "unknown",
          },
        };
        ws.send(ION.stringify(err));
        return;
      }

      const client: SidekickClient = {
        subscribe(topic: string) {
          ws.data.topics.add(topic);
        },
        unsubscribe(topic: string) {
          ws.data.topics.delete(topic);
        },
        getId() {
          return ws.data.id;
        },
        directMessage(msg: SidekickOutgoingMessage) {
          ws.send(ION.stringify(msg));
        },
      };

      await sidekick.handleClientMessage(client, message);
    },
    close(ws: ServerWebSocket<WebSocketData>) {
      connections.delete(ws);
    },
  };

  return { fetch, routes, websocket };
}
