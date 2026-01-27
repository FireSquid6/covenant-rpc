import type { ServerToSidekickConnection, SidekickToServerConnection } from "@covenant/core/lib/interfaces";
import type { ChannelConnectionPayload, ServerMessage } from "@covenant/core/lib/channel";

export function httpSidekickToServer(baseUrl: string, key: string): SidekickToServerConnection {
  const getUrl = (type: string) => {
    const url = new URL(baseUrl);
    url.searchParams.set("type", type);
    return url.toString();
  };

  return {
    async sendMessage(message) {
      const json = JSON.stringify(message);

      const res = await fetch(getUrl("channel"), {
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
