import type { ClientToServerConnection } from ".";
import type { ClientToSidekickConnection } from ".";
import { procedureResponseSchema } from "../procedure";
import { v } from "../validation";

export function httpClientToSidekick(): ClientToSidekickConnection {
  return {
    sendMessage(message) {

    },
    onMessage() {
      return () => { };
    },
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

