import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { Sidekick, type SidekickClient } from "../";
import type { SidekickToServerConnection } from "@covenant-rpc/core/interfaces";
import { v } from "@covenant-rpc/core/validation";
import { channelConnectionPayload, serverMessageSchema } from "@covenant-rpc/core/channel";
import { sidekickIncomingMessageSchema, type SidekickOutgoingMessage } from "@covenant-rpc/core/sidekick/protocol";
import ION from "@covenant-rpc/ion";

interface TrackedWebSocket {
  ws: WebSocket;
  id: string;
  topics: Set<string>;
}

export interface SidekickWebserverOptions {
  secret: string;
  port: number;
  serverConnection: SidekickToServerConnection;
  /** Delay in milliseconds before responding to failed auth attempts (default: 3000) */
  authFailureDelayMs?: number;
}

interface RouteContext {
  sidekick: Sidekick;
  validateKey: (req: IncomingMessage) => Promise<boolean>;
  readBody: (req: IncomingMessage) => Promise<string>;
}

async function handleResourcesRoute(req: IncomingMessage, res: ServerResponse, ctx: RouteContext): Promise<void> {
  if (!await ctx.validateKey(req)) {
    res.writeHead(401).end("Key didn't match");
    return;
  }

  let body: unknown;
  try {
    body = JSON.parse(await ctx.readBody(req));
  } catch {
    res.writeHead(400).end("Invalid JSON");
    return;
  }

  const parsed = v.parseSafe(body, v.obj({ resources: v.array(v.string()) }));
  if (!parsed) {
    res.writeHead(400).end("Invalid body schema");
    return;
  }

  await ctx.sidekick.updateResources(parsed.resources);
  res.writeHead(200).end("OK");
}

async function handleConnectionRoute(req: IncomingMessage, res: ServerResponse, ctx: RouteContext): Promise<void> {
  if (!await ctx.validateKey(req)) {
    res.writeHead(401).end("Key didn't match");
    return;
  }

  let body: unknown;
  try {
    body = ION.parse(await ctx.readBody(req));
  } catch (e) {
    res.writeHead(400).end(`Error parsing ION: ${e}`);
    return;
  }

  const payload = v.parseSafe(body, channelConnectionPayload);
  if (!payload) {
    res.writeHead(400).end("Did not recieve payload in correct schema");
    return;
  }

  ctx.sidekick.addConnection(payload);
  res.writeHead(200).end("OK");
}

async function handleMessageRoute(req: IncomingMessage, res: ServerResponse, ctx: RouteContext): Promise<void> {
  if (!await ctx.validateKey(req)) {
    res.writeHead(401).end("Key didn't match");
    return;
  }

  let body: unknown;
  try {
    body = ION.parse(await ctx.readBody(req));
  } catch (e) {
    res.writeHead(400).end(`Error parsing ION: ${e}`);
    return;
  }

  const message = v.parseSafe(body, serverMessageSchema);
  if (!message) {
    res.writeHead(400).end("Did not recieve message in correct schema");
    return;
  }

  await ctx.sidekick.postServerMessage(message);
  res.writeHead(200).end("OK");
}

async function handleWebSocketMessage(ws: WebSocket, raw: WebSocket.RawData, tracked: TrackedWebSocket, sidekick: Sidekick): Promise<void> {
  let parsed: unknown;
  try {
    parsed = ION.parse(raw.toString());
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
      tracked.topics.add(topic);
    },
    unsubscribe(topic: string) {
      tracked.topics.delete(topic);
    },
    getId() {
      return tracked.id;
    },
    directMessage(message: SidekickOutgoingMessage) {
      ws.send(ION.stringify(message));
    },
  };

  await sidekick.handleClientMessage(client, message);
}

export function startSidekickServer({ port, secret, serverConnection, authFailureDelayMs = 3000 }: SidekickWebserverOptions): Server {
  const connections = new Set<TrackedWebSocket>();

  const sidekick = new Sidekick(async (topic, message) => {
    const data = ION.stringify(message);
    for (const conn of connections) {
      if (conn.topics.has(topic)) {
        conn.ws.send(data);
      }
    }
  }, serverConnection);

  async function validateKey(req: IncomingMessage): Promise<boolean> {
    const authorization = req.headers["authorization"];
    if (authorization !== `Bearer ${secret}`) {
      if (authFailureDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, authFailureDelayMs));
      }
      return false;
    }
    return true;
  }

  function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      req.on("end", () => resolve(body));
      req.on("error", reject);
    });
  }

  const routeContext: RouteContext = {
    sidekick,
    validateKey,
    readBody,
  };

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (req.method !== "POST") {
      res.writeHead(404).end("Not Found");
      return;
    }

    switch (url.pathname) {
      case "/resources":
        await handleResourcesRoute(req, res, routeContext);
        return;
      case "/connection":
        await handleConnectionRoute(req, res, routeContext);
        return;
      case "/message":
        await handleMessageRoute(req, res, routeContext);
        return;
      default:
        res.writeHead(404).end("Not Found");
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    if (url.pathname !== "/socket") {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const tracked: TrackedWebSocket = {
        ws,
        id: crypto.randomUUID(),
        topics: new Set(),
      };
      connections.add(tracked);

      ws.on("close", () => {
        connections.delete(tracked);
      });

      ws.on("message", async (raw) => {
        await handleWebSocketMessage(ws, raw, tracked, sidekick);
      });
    });
  });

  httpServer.listen(port);
  return httpServer;
}
