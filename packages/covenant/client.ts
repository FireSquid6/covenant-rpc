import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ProcedureMap, ChannelMap, Covenant, ProcedureDeclaration } from ".";
import { type Flatten, type Listener } from "./utils";
import { getResponseSchema, type ProcedureError, type ProcedureResponse } from "./response";
import type { ProcedureRequest } from "./request";
import type { CovenantServer } from "./server";


export interface ClientMessenger {
  fetch(request: ProcedureRequest): Promise<Response>;
}

export type InferProcedureInputs<T> = Flatten<
  T extends ProcedureDeclaration<infer Input, any, any>
  ? StandardSchemaV1.InferInput<Input>
  : never
>

export type InferProcedureOutputs<T> = Flatten<
  T extends ProcedureDeclaration<any, infer Output, any>
  ? Output extends StandardSchemaV1
  ? ProcedureResponse<Output>
  : never
  : never
>;


export type MutationKey<P extends ProcedureMap> = { [k in keyof P]: P[k]["type"] extends "mutation" ? k : never }[keyof P]
export type QueryKey<P extends ProcedureMap> = { 
  [k in keyof P]: P[k]["type"] extends "query" ? k : never 
}[keyof P]


export class CovenantClient<P extends ProcedureMap, C extends ChannelMap> {
  private covenant: Covenant<P, C>;
  private messenger: ClientMessenger;
  private listeners: Map<string, (() => Promise<void>)[]> = new Map();


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
      //@ts-expect-error we know more than the typescript compiler here
      return {
        result: "ERROR",
        error: {
          message: `Output validation failed: ${validation.issues}`,
          httpCode: res.status,
        },
        data: undefined,
      }
    }

    //@ts-expect-error we know more than the typescript compiler here
    return validation.value;
  }

  async mutate<K extends MutationKey<P>>(procedure: K, inputs: InferProcedureInputs<P[K]>) {
    const result = this.call(procedure, inputs);
    const resources = this.covenant.procedures[procedure]!.resources(inputs);

    // we call this without awaiting so that it happens in the background
    this.refetchResources(resources);

    return result;
  }

  private async refetchResources(resources: string[]) {
    const s = new Set(resources);
    const neededListeners = this.listeners.keys().filter(k => s.has(k));
    const functions: (() => Promise<void>)[] = [];
    
    for (const l of neededListeners) {
      functions.push(...(this.listeners.get(l)!));
    }

    await Promise.all(functions.map(f => f()));
  }

  async query<K extends QueryKey<P>>(procedure: K, inputs: InferProcedureInputs<P[K]>) {
    return await this.call(procedure, inputs);
  }

  localListen<K extends QueryKey<P>>(
    procedure: K,
    inputs: InferProcedureInputs<P[K]>,
    callback: Listener<InferProcedureOutputs<P[K]>>
  ): () => void {
    const schema = this.covenant.procedures[procedure]!;
    if (schema.type !== "query") {
      throw new Error("Tried to listen to a mutation which makes no sense");
    }

    const resources =  schema.resources(inputs);

    const listener = async () => {
      callback(await this.call(procedure, inputs));
    }

    // we also go ahead and call the listener to do an
    // initial fetch
    this.addListener(resources, listener);
    listener();

    // unsubscribe function
    return () => {
      this.removeListener(resources, listener);
    }
  }

  private addListener(resources: string[], listener: () => Promise<void>) {
    for (const r of resources) {
      if (this.listeners.has(r)) {
        const newListeners = [...(this.listeners.get(r)!)];
        newListeners.push(listener);
        this.listeners.set(r, newListeners);
      } else {
        this.listeners.set(r, [listener]);
      }
    }
  }

  private removeListener(resources: string[], listener: () => Promise<void>) {
    for (const r of resources) {
      if (this.listeners.has(r)) {
        const currentListeners = this.listeners.get(r)!;
        const newListeners = currentListeners.filter(l => l !== listener);
        this.listeners.set(r, newListeners);
      }
    }
  }

  async callUnwrap<K extends keyof P>(
    procedure: K,
    inputs: InferProcedureInputs<P[K]>,
    thrower?: (error: ProcedureError) => never,
  ): Promise<StandardSchemaV1.InferOutput<P[K]["output"]>> {
    const { result, error, data } = await this.call(procedure, inputs);

    if (result === "ERROR") {
      if (thrower) {
        // not sure why this isn't inferred to be not null but whatever
        thrower(error!);
      }
      throw new Error(`Unwrapped an error calling ${String(procedure)} (${error?.httpCode}): ${error?.message}`);
    }

    return data;
  }

  listen() {

  }
}

// TODO - add the ability to set the headers on a fetch
export function httpMessenger({ httpUrl }: { httpUrl: string }): ClientMessenger {
  return {
    fetch(request: ProcedureRequest): Promise<Response> {
      const url = new URL(httpUrl)
      url.searchParams.set("type", "procedure")


      return fetch(url.toString(), {
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
