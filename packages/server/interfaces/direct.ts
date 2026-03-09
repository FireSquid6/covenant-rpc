import type { ClientToServerConnection, ServerToSidekickConnection, SidekickToServerConnection } from "@covenant-rpc/core/interfaces";
import type { ProcedureRequestBody, ProcedureResponse } from "@covenant-rpc/core/procedure";
import type { CovenantServer } from "../server";
import type { Sidekick } from "../sidekick";
import { v } from "@covenant-rpc/core/validation";
import { procedureResponseSchema } from "@covenant-rpc/core/procedure";
import { channelConnectionRequestSchema, channelConnectionResponseSchema, type ChannelConnectionRequest, type ChannelConnectionResponse } from "@covenant-rpc/core/channel";
import ION from "@covenant-rpc/ion";


export function directClientToServer(
  server: CovenantServer<any, any, any, any>,
  extraHeaders: Record<string, string>
): ClientToServerConnection {
  const getHeaders = () => {
    const h = new Headers();
    h.set("Content-Type", "application/json");

    for (const k in extraHeaders) {
      h.set(k, extraHeaders[k]!);
    }
    return h;
  }

  const getUrl = (type: string) => {
    const url = new URL("localhost:3000");
    url.searchParams.set("type", type);
    return url.toString();
  }

  return {
    async sendConnectionRequest(body: ChannelConnectionRequest): Promise<ChannelConnectionResponse> {
      try {
        const request = new Request(getUrl("connect"), {
          body: ION.stringify(body),
          method: "POST",
          headers: getHeaders(),
        });

        const response = await server.handle(request);
        const responseText = await response.text();
        const responseBody = ION.parse(responseText);
        const connectionResponse = v.parseSafe(responseBody, channelConnectionResponseSchema);

        if (connectionResponse === null) {
          return {
            channel: body.channel,
            params: body.params,
            result: {
              type: "ERROR",
              error: {
                channel: body.channel,
                params: body.params,
                fault: "server",
                message: `Bad response from server: ${JSON.stringify(responseBody)}`,
              },
            },
          };
        }

        return connectionResponse;
      } catch (e) {
        return {
          channel: body.channel,
          params: body.params,
          result: {
            type: "ERROR",
            error: {
              channel: body.channel,
              params: body.params,
              fault: "server",
              message: `Unknown error connecting to channel: ${e}`,
            },
          },
        };
      }
    },
    async runProcedure(body: ProcedureRequestBody) {
      try {
        const request = new Request(getUrl("procedure"), {
          body: ION.stringify(body),
          method: "POST",
          headers: getHeaders(),
        });

        const response = await server.handle(request);
        const responseText = await response.text();
        const responseBody = ION.parse(responseText);
        const procedureResponse = v.parseSafe(responseBody, procedureResponseSchema)

        if (procedureResponse === null) {
          return {
            status: "ERR",
            error: {
              code: 500,
              message: `Bad response from server: ${responseBody}`,
            }
          }
        }

        return procedureResponse;
      } catch (e) {
        return {
          status: "ERR",
          error: {
            code: 400,
            message: `Unknown error fetching from the server: ${e}`,
          }
        }
      }
    }

  }

}

export function directSidekickToServer(
  server: CovenantServer<any, any, any, any>,
): SidekickToServerConnection {
  return {
    async sendMessage(message) {
      try {
        const url = new URL("http://localhost");
        url.searchParams.set("type", "channel");

        const request = new Request(url.toString(), {
          method: "POST",
          body: ION.stringify(message),
          headers: { "Content-Type": "application/json" },
        });

        const response = await server.handle(request);

        if (response.ok) {
          return null;
        }

        return {
          channel: message.channel,
          params: message.params,
          fault: "server",
          message: `Failed to send message to server. Received: ${response.status} - ${response.statusText}`,
        };
      } catch (e) {
        return {
          channel: message.channel,
          params: message.params,
          fault: "server",
          message: `Unknown error sending message to server: ${e}`,
        };
      }
    },
  };
}

export function directServerToSidekick(sidekick: Sidekick): ServerToSidekickConnection {
  return {
    addConnection(payload) {
      sidekick.addConnection(payload);
      return Promise.resolve(null);
    },
    async update(resources) {
      await sidekick.updateResources(resources);
      return null;
    },
    async postMessage(message) {
      await sidekick.postServerMessage(message);
      return null;
    },
  };
}
