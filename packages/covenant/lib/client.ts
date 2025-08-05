import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ProcedureMap, ChannelMap, Covenant, ProcedureDeclaration } from ".";
import type { Flatten } from "./utils";
import { getResponseSchema, type ProcedureResponse } from "./response";
import type { ProcedureRequest } from "./request";
import type { CovenantServer } from "./server";


export interface ClientMessenger {
  fetch(request: ProcedureRequest): Promise<Response>;
}

export type InferProcedureInputs<T> = Flatten<
  T extends ProcedureDeclaration<infer Input, any>
  ? StandardSchemaV1.InferInput<Input>
  : never
>

export type InferProcedureOutputs<T> = Flatten<
  T extends ProcedureDeclaration<any, infer Output>
  ? Output extends StandardSchemaV1
  ? ProcedureResponse<Output>
  : never
  : never
>;


export class CovenantClient<P extends ProcedureMap, C extends ChannelMap> {
  private covenant: Covenant<P, C>;
  private messenger: ClientMessenger;


  constructor(covenant: Covenant<P, C>, messenger: ClientMessenger) {
    this.covenant = covenant;
    this.messenger = messenger;
  }

  async call<K extends keyof P>(procedure: K, inputs: InferProcedureInputs<P[K]>): Promise<InferProcedureOutputs<P[K]>> {
    const req: ProcedureRequest = {
      procedure: String(procedure),
      inputs,
    }

    const outputSchema = this.covenant.procedures[procedure]?.output!;
    const res = await this.messenger.fetch(req);
    const body = await res.json();
    const responseSchema = getResponseSchema(outputSchema);

    const validation = await responseSchema["~standard"].validate(body);

    if (validation.issues) {
      // @ts-expect-error types are too deep for ts to understand properly
      return {
        result: "ERROR",
        error: {
          message: `Output validation failed: ${validation.issues}`,
          httpCode: res.status,
        },
        data: undefined,
      }
    }

    //@ts-expect-error types are too deep for tsc to understand properly
    return validation.value;
  }
}

// TODO - add the ability to set the headers on a fetch
export function httpMessenger({ procedureUrl }: { procedureUrl: string }): ClientMessenger {
  return {
    fetch(request: ProcedureRequest): Promise<Response> {
      return fetch(procedureUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });
    }
  }
}

export function directMessenger(server: CovenantServer<any, any, any>): ClientMessenger {
  return {
    fetch(request: ProcedureRequest): Promise<Response> {
      const req: Request = new Request({
        url: "http://localhost:3000",
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(request),
      })

      return server.handleProcedure(req);
    }
  }
}
