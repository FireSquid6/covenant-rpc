import type { CovenantRequest } from "./request";
import type { RouteMap, InferRouteInput, InferRouteResponse } from ".";
import { getResponseSchema } from "./response";


export type Fetcher = (req: CovenantRequest) => Promise<Response>;


export class CovenantClient<T extends RouteMap> {
  private schema: T;
  private fetcher: Fetcher;

  constructor(schema: T, fetcher: Fetcher) {
    this.schema = schema;
    this.fetcher = fetcher;
  }

  async fetch<K extends keyof T>(func: K, inputs: InferRouteInput<T[K]>): Promise<InferRouteResponse<T[K]>> {
    const req: CovenantRequest = {
      function: String(func),
      inputs: inputs,
    }

    const outputSchema = this.schema[func]?.output!;
    const res = await this.fetcher(req);

    const body = await res.json();
    const responseSchema = getResponseSchema(outputSchema);

    const validation = await responseSchema["~standard"].validate(body);

    if (validation.issues) {
      // @ts-ignore
      return {
        status: "ERROR",
        messsage: `Error validating: ${validation.issues}`,
        httpCode: 400,
        fault: "client",
      } as InferRouteResponse<T[K]>
    }

    // @ts-ignore
    return validation.value;
  }

}


// TODO - allow user to set headers that are always set
export function httpFetcher(url: string): Fetcher {
  return (req: CovenantRequest) => {
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(req)
    })
  }
}



