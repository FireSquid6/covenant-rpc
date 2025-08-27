import type { ClientToServerConnection, ServerToSidekickConnection, ClientToSidekickConnection } from ".";
import type { ProcedureRequestBody, ProcedureResponse } from "../procedure";
import type { CovenantServer } from "../server";
import { v } from "../validation";
import { procedureResponseSchema } from "../procedure";


export function directClientToServerConnection(
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
    sendConnectionRequest: () => {
      throw new Error("not implemented");
    },
    async runProcedure(body: ProcedureRequestBody) {
      try {
        const request = new Request(getUrl("procedure"), {
          body: JSON.stringify(body),
          method: "POST",
          headers: getHeaders(),
        });

        const response = await server.handle(request);
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
