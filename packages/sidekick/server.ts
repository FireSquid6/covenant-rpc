import { Elysia, t } from "elysia";
import { resourceUpdateSchema } from "covenant/realtime";
import { handleMessage, type SocketContext } from "./handlers";
import { incomingMessageSchema, makeOutgoing } from ".";


export interface SidekickOptions {
  covenantEndpoint: string;
  covenantSecret: string;
}

export function getSidekick({ covenantEndpoint, covenantSecret }: SidekickOptions): Elysia {
  const ctx: SocketContext = {
    listeningMap: new Map(),
  }

  return new Elysia()
    .post("/update", async ({ body, status }) => {
      const { data: update, error, success } = resourceUpdateSchema.safeParse(body);


      if (!success) {
        return status(400, `Failed to parse body: ${error}`)
      }

      if (update.secret !== covenantSecret) {
        // wait 5 seconds to avoid someone brute forcing the wrong secret
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return status(401, `Secret did not match`);
      }

      console.log(`Recieved updates to ${update.resources}`);

    }, {
      // we self validate
      body: t.Any(),
    })
    .post("/message", () => {
      // TODO - server posts its mesages here

    })
    .ws("/connect", {
      message: async (ws, message) => {
        const { data: msg, success, error } = incomingMessageSchema.safeParse(JSON.parse(message as string));

        if (!success) {
          ws.send(makeOutgoing({
            type: "error",
            error: `Improper message format: ${error.message}`,
          }));
          return;
        }

        try {
          const response = handleMessage(msg, ctx, ws);
          ws.send(makeOutgoing(response));
          return;
        } catch (e) {
          ws.send(makeOutgoing({
            type: "error",
            error: `Unhandled error: ${e}`,
          }));
        }
      },
      close: (ws) => {
        ctx.listeningMap.delete(ws.id);
      },
    })
}


export type UpdateListener = () => Promise<void> | void;

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

  unlistenTo(resources: string[], listener: () => Promise<void>) {
    for (const r of resources) {
      if (this.listeners.has(r)) {
        const currentListeners = this.listeners.get(r)!;
        const newListeners = currentListeners.filter(l => l !== listener);
        this.listeners.set(r, newListeners);
      }
    }
  }

  unlistenAll(listener: () => Promise<void>) {
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

    await Promise.all(listenersToCall.values().map(l => l()))
  }
}
