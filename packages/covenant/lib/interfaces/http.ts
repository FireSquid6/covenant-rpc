import type { ClientToServerConnection, ServerToSidekickConnection, SidekickToServerConnection } from ".";
import type { ClientToSidekickConnection } from ".";
import type { ChannelConnectionPayload, ServerMessage } from "../channel";
import { procedureResponseSchema } from "../procedure";
import { sidekickIncomingMessageSchema, type SidekickIncomingMessage, type SidekickOutgoingMessage } from "../sidekick/protocol";
import { isPromise, type MaybePromise } from "../utils";
import { v } from "../validation";

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
      const message = v.parseSafe(m, sidekickIncomingMessageSchema);

      if (!message) {
        await this.emitMessage({
          type: "error",
          error: {
            fault: "sidekick",
            message: "Error parsing incoming message from sidekick",
            channel: "unknown",
            params: {},
          }
        })
      }
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
    async sendConnectionRequest(r) {
      throw new Error("connection request not implemented yet");
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


export function httpSidekickToServer(url: string, key: string): SidekickToServerConnection {
  return {
    async sendMessage(message) {
      const json = JSON.stringify(message); 

      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: json,
      });

      if (res.ok) {
        return null;
      }

      return {
        channel: message.channel,
        params: message.params,
        fault: "server",
        message: `Failed to send message to server. Received: ${res.status} - ${res.statusText}`,
      }
    },
  }
}


class HttpServerToSidekick implements ServerToSidekickConnection {
  private url: URL;
  private key: string;

  constructor(url: string, key: string) {
    this.url = new URL(url);
    this.key = key;
  }

  async addConnection(payload: ChannelConnectionPayload): Promise<Error | null> {
    const url = new URL(this.url.toString());
    url.pathname = "/connection";

    const res = await fetch(url.toString(), {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.key}`,
      },
      method: "POST",
    });

    if (!res.ok) {
      return new Error(`Error posting connection from sidekick: ${res.status} - ${res.statusText}`);
    }
    return null;
  }

  async update(resources: string[]): Promise<Error | null> {
    const url = new URL(this.url.toString());
    url.pathname = "/resources";
    
    const res = await fetch(url.toString(), {
      body: JSON.stringify({
        resources: resources,
      }),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.key}`,
      },
      method: "POST",
    });

    if (!res.ok) {
      return new Error(`Error posting resources from sidekick: ${res.status} - ${res.statusText}`);
    }
    return null;
  }

  async postMessage(message: ServerMessage): Promise<Error | null> {
    const url = new URL(this.url.toString());
    url.pathname = "/message";
    
    const res = await fetch(url.toString(), {
      body: JSON.stringify(message),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.key}`,
      },
      method: "POST",
    });

    if (!res.ok) {
      return new Error(`Error posting message from sidekick: ${res.status} - ${res.statusText}`);
    }
    return null;
  }
}

export function httpServerToSidekick(url: string, key: string): ServerToSidekickConnection {
  return new HttpServerToSidekick(url, key);
}
