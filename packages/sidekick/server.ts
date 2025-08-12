import { Elysia, t } from "elysia";
import { resourceUpdateSchema } from "covenant/realtime";
import type { SocketContext } from "./messageHandlers";


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

      },
      close: (ws) => {
        ctx.delete(ws.id);
      },
    })
}


