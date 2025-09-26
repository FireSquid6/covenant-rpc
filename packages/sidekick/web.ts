import { Elysia, t } from "elysia";
import { Sidekick } from "@covenant/rpc/sidekick/index";
import type { SidekickClient } from "@covenant/rpc/sidekick/index";
import { v } from "@covenant/rpc/validation";
import { channelConnectionPayload, serverMessageSchema } from "@covenant/rpc/channel";
import { sidekickIncomingMessageSchema, type SidekickOutgoingMessage } from "@covenant/rpc/sidekick/protocol";

const app = new Elysia()
  // we set the actual sidekick later
  .state("sidekick", {} as Sidekick)
  .state("key", "")
  .derive(({ store, headers, status }) => {
    return {
      async validateKey() {
        const authorization = headers["authorization"];
        if (authorization !== `Bearer ${store.key}`) {
          // wait several seconds to avoid spam
          await new Promise((resolve) => setTimeout(resolve, 3000));
          return status("Unauthorized", "Key didn't match");
        }
      }
    }
  })
  .ws("/socket", {
    async message(ws, data) {
      const message = v.parseSafe(data, sidekickIncomingMessageSchema);
      const sidekick = ws.data.store.sidekick;

      if (message === null) {
        const err: SidekickOutgoingMessage = {
          type: "error",
          error: {
            fault: "client",
            message: "Failed to parse last message as an incoming message. This is a bug in covenant's client code.",
            params: {},
            channel: "unknown",
          }
        }

        ws.send(JSON.stringify(err));
        return;
      }
    
      const client: SidekickClient = {
        subscribe(topic: string) {
          ws.subscribe(topic);
        },
        unsubscribe(topic: string) {
          ws.unsubscribe(topic);
        },
        getId() {
          return ws.id;
        },
        directMessage(message: SidekickOutgoingMessage) {
          ws.send(JSON.stringify(message));
        },
      }

      await sidekick.handleClientMessage(client, message);
    },
  })
  .post("/resources", async ({ body, status, store: { sidekick }, validateKey }) => {
    await validateKey();
    await sidekick.updateResources(body.resources);

    return status("OK");
  }, {
    body: t.Object({
      resources: t.Array(t.String()),
    })
  })
  .post("/connection", async ({ request, store: { sidekick }, status, validateKey }) => {
    await validateKey();

    let body: unknown = undefined;
    try { 
      body = await request.json();
    } catch (e) {
      return status("Bad Request", `Error parsing json: ${e}`);
    }

    const payload = v.parseSafe(body, channelConnectionPayload);

    if (!payload) {
      return status("Bad Request", "Did not recieve payload in correct schema");
    }

    sidekick.addConnection(payload);
    return status("OK");
  })
  .post("/message", async ({ request, store: { sidekick }, status, validateKey }) => {
    await validateKey();

    let body: unknown = undefined;
    try { 
      body = await request.json();
    } catch (e) {
      return status("Bad Request", `Error parsing json: ${e}`);
    }

    const message = v.parseSafe(body, serverMessageSchema);

    if (!message) {
      return status("Bad Request", "Did not recieve message in correct schema");
    }

    await sidekick.postServerMessage(message);
    return status("OK");
  })
 
export function getSidekickApi(secret: string) {
  const sidekick = new Sidekick(async (topic, message) => {
    const server = app.server;
    if (!server) {
      throw new Error("Server was null. Elysia is not functioning properly");
    }

    server.publish(topic, JSON.stringify(message));
  })
  app.store.sidekick = sidekick;
  app.store.key = secret;

  return app
}
