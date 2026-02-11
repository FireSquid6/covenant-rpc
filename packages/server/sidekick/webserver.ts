import { createServer, type IncomingMessage, type Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { Sidekick, type SidekickClient } from "../";
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
}

export function startSidekickServer({ port, secret }: SidekickWebserverOptions): Server {
  const connections = new Set<TrackedWebSocket>();

  const sidekick = new Sidekick(async (topic, message) => {
    const data = ION.stringify(message);
    for (const conn of connections) {
      if (conn.topics.has(topic)) {
        conn.ws.send(data);
      }
    }
  });

  async function validateKey(req: IncomingMessage): Promise<boolean> {
    const authorization = req.headers["authorization"];
    if (authorization !== `Bearer ${secret}`) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
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

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (req.method !== "POST") {
      res.writeHead(404).end("Not Found");
      return;
    }

    if (url.pathname === "/resources") {
      if (!await validateKey(req)) {
        res.writeHead(401).end("Key didn't match");
        return;
      }

      let body: unknown;
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        res.writeHead(400).end("Invalid JSON");
        return;
      }

      const parsed = v.parseSafe(body, v.obj({ resources: v.array(v.string()) }));
      if (!parsed) {
        res.writeHead(400).end("Invalid body schema");
        return;
      }

      await sidekick.updateResources(parsed.resources);
      res.writeHead(200).end("OK");
      return;
    }

    if (url.pathname === "/connection") {
      if (!await validateKey(req)) {
        res.writeHead(401).end("Key didn't match");
        return;
      }

      let body: unknown;
      try {
        body = ION.parse(await readBody(req));
      } catch (e) {
        res.writeHead(400).end(`Error parsing ION: ${e}`);
        return;
      }

      const payload = v.parseSafe(body, channelConnectionPayload);
      if (!payload) {
        res.writeHead(400).end("Did not recieve payload in correct schema");
        return;
      }

      sidekick.addConnection(payload);
      res.writeHead(200).end("OK");
      return;
    }

    if (url.pathname === "/message") {
      if (!await validateKey(req)) {
        res.writeHead(401).end("Key didn't match");
        return;
      }

      let body: unknown;
      try {
        body = ION.parse(await readBody(req));
      } catch (e) {
        res.writeHead(400).end(`Error parsing ION: ${e}`);
        return;
      }

      const message = v.parseSafe(body, serverMessageSchema);
      if (!message) {
        res.writeHead(400).end("Did not recieve message in correct schema");
        return;
      }

      await sidekick.postServerMessage(message);
      res.writeHead(200).end("OK");
      return;
    }

    res.writeHead(404).end("Not Found");
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
      });
    });
  });

  httpServer.listen(port);
  return httpServer;
}
