import { Sidekick } from "@covenant-rpc/server";
import { v } from "@covenant-rpc/core/validation";
import { channelConnectionPayload, serverMessageSchema } from "@covenant-rpc/core/channel";
import ION from "@covenant-rpc/ion";

export interface SidekickAdapterOptions {
  secret: string;
  prefix: string;
  sidekick: Sidekick;
}

const resourcesBodySchema = v.obj({
  resources: v.array(v.string()),
});

export type SidekickAdapter = (req: Request) => Response | Promise<Response>;

export function getSidekickAdapter(options: SidekickAdapterOptions): SidekickAdapter {
  const { secret, sidekick } = options;
  const prefix = options.prefix.endsWith("/") ? options.prefix.slice(0, -1) : options.prefix;

  async function validateKey(req: Request): Promise<Response | null> {
    const authorization = req.headers.get("authorization");
    if (authorization !== `Bearer ${secret}`) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return new Response("Unauthorized", { status: 401 });
    }
    return null;
  }

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method !== "POST") {
      return new Response("Not Found", { status: 404 });
    }

    if (path === `${prefix}/connection`) {
      const authError = await validateKey(req);
      if (authError) return authError;

      let body: unknown;
      try {
        const bodyText = await req.text();
        body = ION.parse(bodyText);
      } catch (e) {
        return new Response(`Error parsing ION: ${e}`, { status: 400 });
      }

      const payload = v.parseSafe(body, channelConnectionPayload);
      if (!payload) {
        return new Response("Did not receive payload in correct schema", { status: 400 });
      }

      sidekick.addConnection(payload);
      return new Response("OK", { status: 200 });
    }

    if (path === `${prefix}/resources`) {
      const authError = await validateKey(req);
      if (authError) return authError;

      let body: unknown;
      try {
        body = await req.json();
      } catch (e) {
        return new Response(`Error parsing JSON: ${e}`, { status: 400 });
      }

      const parsed = v.parseSafe(body, resourcesBodySchema);
      if (!parsed) {
        return new Response("Did not receive resources in correct schema", { status: 400 });
      }

      await sidekick.updateResources(parsed.resources);
      return new Response("OK", { status: 200 });
    }

    if (path === `${prefix}/message`) {
      const authError = await validateKey(req);
      if (authError) return authError;

      let body: unknown;
      try {
        const bodyText = await req.text();
        body = ION.parse(bodyText);
      } catch (e) {
        return new Response(`Error parsing ION: ${e}`, { status: 400 });
      }

      const message = v.parseSafe(body, serverMessageSchema);
      if (!message) {
        return new Response("Did not receive message in correct schema", { status: 400 });
      }

      await sidekick.postServerMessage(message);
      return new Response("OK", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  };
}
