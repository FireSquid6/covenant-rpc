import { Elysia } from "elysia";
import { resourceUpdateSchema } from "covenant/realtime";
import { getChannelTopicName, getResourceTopicName, handleMessage, type SocketContext } from "./handlers";
import { incomingMessageSchema, makeOutgoing } from ".";
import { logger } from "@bogeychan/elysia-logger";
import { untypedServerMessageSchema } from "covenant/channels";
import { httpEdgeConnection } from "./connection";


export interface SidekickOptions {
  covenantEndpoint: string;
  covenantSecret: string;
}

export function getSidekick({ covenantEndpoint, covenantSecret }: SidekickOptions): Elysia {
  const ctx: SocketContext = {
    contextMap: new Map<string, unknown>(),
    edgeConnection: httpEdgeConnection(covenantEndpoint),
    key: covenantSecret,
  }


  const app: Elysia<any, any, any, any> = new Elysia()
    .use(
      logger({
        level: "info",
      })
    )
    .post("/update", async ({ status, request, server }) => {
      const body = await request.json();
      const { data: update, error, success } = resourceUpdateSchema.safeParse(body);


      if (!success) {
        return status(400, `Failed to parse body: ${error}`)
      }

      if (update.secret !== covenantSecret) {
        // wait 5 seconds to avoid someone brute forcing the wrong secret
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return status(401, `Secret did not match`);
      }
      if (server === null) {
        return status(500, `Server was null. Could not send websockets`);
      }

      for (const resource of update.resources) {
        console.log("Publishing to", resource);
        server.publish(getResourceTopicName(resource), makeOutgoing({
          type: "updated",
          resource,
        }));
      }

      console.log(`Recieved updates to ${update.resources}`);
    })
    .get("/ping", () => {
      return "pong!";
    })
    .post("/message", async ({ status, server, request, headers }) => {
      const body = await request.json();
      const { data: message, error, success } = untypedServerMessageSchema.safeParse(body);

      if (!success) {
        return status(400, `Bad inputs: ${error}`);
      }

      const key = headers["authorization"];

      if (key !== `Bearer ${covenantSecret}`) {
        return status(401, `Not authorized`);
      }

      if (server === null) {
        return status(500, `Server was null. Could not send websockets`);
      }

      if (message.type === "ERROR") {
        // TODO - modify the protocol so that we can get these errors
        // back to the correct client
        console.log(message.error);
        return status(201, "Created");
      }

      const topic = getChannelTopicName(message.channel, message.params);

      server.publish(topic, makeOutgoing({
        type: "message",
        data: message,
      }))

      return status(201, "Created")
    })
    .ws("/connect", {
      beforeHandle: (ctx) => {
        // TODO - validate connection
        //
        // we should implement something here to ensure that it isn't just
        // garbage spam requests coming in

      },
      open: (ws) => {
        console.log(`New connection from ${ws.id}`);
      },
      message: async (ws, message) => {
        console.log(message);
        const { data: msg, success, error } = incomingMessageSchema.safeParse(message);

        if (!success) {
          console.log(error);
          ws.send(makeOutgoing({
            type: "error",
            error: `Improper message format: ${error.message}`,
          }));
          return;
        }

        try {
          const response = await handleMessage(msg, ctx, ws);
          if (response !== null) {
            ws.send(makeOutgoing(response));
          }
        } catch (e) {
          ws.send(makeOutgoing({
            type: "error",
            error: `Unhandled error: ${e}`,
          }));
        }
      },
      close: (ws) => {
      },
    })

  return app;
}

export type UpdateListener = (resources: string[]) => Promise<void> | void;

export class Updater {
  private listeners: Map<string, UpdateListener[]> = new Map();

  // update listener should listen to every resource in the
  // resources list
  listenTo(resources: string[], listener: UpdateListener) {
    for (const r of resources) {
      if (this.listeners.has(r)) {
        const newListeners = [...this.listeners.get(r)!];
        newListeners.push(listener);
        this.listeners.set(r, newListeners);
      } else {
        this.listeners.set(r, [listener]);
      }
    }
  }

  unlistenTo(resources: string[], listener: UpdateListener) {
    for (const r of resources) {
      if (this.listeners.has(r)) {
        const currentListeners = this.listeners.get(r)!;
        const newListeners = currentListeners.filter(l => l !== listener);
        this.listeners.set(r, newListeners);
      }
    }
  }

  unlistenAll(listener: UpdateListener) {
    for (const k of this.listeners.keys()) {
      const currentListeners = this.listeners.get(k)!;
      const newListeners = currentListeners.filter(l => l !== listener);
      this.listeners.set(k, newListeners);
    }
  }

  async update(resources: string[]) {
    const listenersToCall = new Set<UpdateListener>();

    // ugly ugly function! I hate this!
    for (const r of resources) {
      if (this.listeners.has(r)) {
        for (const l of this.listeners.get(r)!) {
          if (!listenersToCall.has(l)) {
            listenersToCall.add(l);
          }
        }
      }
    }

    await Promise.all(listenersToCall.values().map(l => l(resources)))
  }
}

