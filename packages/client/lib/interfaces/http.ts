import type { ClientToServerConnection, ClientToSidekickConnection } from "@covenant/core/interfaces";
import type { ChannelConnectionRequest, ChannelConnectionResponse } from "@covenant/core/channel";
import { procedureResponseSchema } from "@covenant/core/procedure";
import { channelConnectionResponseSchema } from "@covenant/core/channel";
import { sidekickOutgoingMessageSchema, type SidekickIncomingMessage, type SidekickOutgoingMessage } from "@covenant/core/sidekick/protocol";
import { isPromise, type MaybePromise } from "@covenant/core/utils";
import { v } from "@covenant/core/validation";

export function httpClientToSidekick(rootUrl: string): ClientToSidekickConnection {
  return new HttpClientToSidekick(rootUrl);
}

class HttpClientToSidekick implements ClientToSidekickConnection {
  socketUrl: string
  listeners: ((m: SidekickOutgoingMessage) => MaybePromise<void>)[] = [];

  //@ts-expect-error we define this in the reconnectSocket method which is called by the constructor
  socket: WebSocket;
  ready: boolean = false;
  sendQueue: SidekickIncomingMessage[] = []

  constructor(rootUrl: string) {
    const url = new URL(rootUrl);
    const protocol = url.protocol === "https:" ? "wss" : "ws";
    this.socketUrl = `${protocol}://${url.host}/socket`;

    this.reconnectSocket();
  }

  private reconnectSocket() {
    this.socket = new WebSocket(this.socketUrl);
    this.ready = false;


    this.socket.onmessage = async (m) => {
      let data: unknown;
      try {
        data = typeof m.data === 'string' ? JSON.parse(m.data) : m.data;
      } catch (e) {
        await this.emitMessage({
          type: "error",
          error: {
            fault: "sidekick",
            message: "Error parsing JSON from sidekick message",
            channel: "unknown",
            params: {},
          }
        });
        return;
      }

      const message = v.parseSafe(data, sidekickOutgoingMessageSchema);

      if (!message) {
        await this.emitMessage({
          type: "error",
          error: {
            fault: "sidekick",
            message: "Error parsing incoming message from sidekick",
            channel: "unknown",
            params: {},
          }
        });
        return;
      }

      await this.emitMessage(message);
    }

    this.socket.onopen = () => {
      this.ready = true;

      for (const m of this.sendQueue) {
        this.socket.send(JSON.stringify(m));
      }
    }

    this.socket.onclose = () => {
      this.ready = false;
    }

    this.socket.onerror = async () => {
      this.ready = false;

      await this.emitMessage({
        type: "error",
        error: {
          fault: "client",
          message: "Unknown websocket error",
          channel: "unknown",
          params: {},
        }
      })
    }
  }

  private async emitMessage(m: SidekickOutgoingMessage) {
    const promises: Promise<void>[] = [];
    for (const l of this.listeners) {
      const p = l(m);
      if (isPromise(p)) {
        promises.push(p);
      }
    }

    await Promise.all(promises);
  }

  sendMessage(message: SidekickIncomingMessage): void {
    if (this.ready) {
      const json = JSON.stringify(message);
      this.socket.send(json);
    } else {
      this.sendQueue.push(message);
    }
  }

  onMessage(handler: (m: SidekickOutgoingMessage) => MaybePromise<void>): () => void {
    this.listeners.push(handler);

    return () => {
      const newListeners = this.listeners.filter(l => l !== handler);
      this.listeners = newListeners;
    }
  }
}


export function httpClientToServer(covenantUrl: string, extraHeaders: Record<string, string>): ClientToServerConnection {
  const getHeaders = () => {
    const h = new Headers();
    h.set("Content-Type", "application/json");

    for (const k in extraHeaders) {
      h.set(k, extraHeaders[k]!);
    }
    return h;
  }

  const getUrl = (type: string) => {
    const url = new URL(covenantUrl);
    url.searchParams.set("type", type);
    return url.toString();
  }

  return {
    async sendConnectionRequest(body: ChannelConnectionRequest): Promise<ChannelConnectionResponse> {
      try {
        const headers = getHeaders();
        const url = getUrl("connect");

        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        const responseBody = await response.json();
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
    async runProcedure(body) {
      try {
        const headers = getHeaders();
        const url = getUrl("procedure");

        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        const responseBody = await response.json();
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
