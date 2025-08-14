import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ProcedureMap, ChannelMap, Covenant, ProcedureDeclaration } from ".";
import { type Flatten, type Listener } from "./utils";
import { getProcedureResponseSchema, type ProcedureError, type ProcedureResponse } from "./response";
import type { ProcedureRequest } from "./request";
import type { CovenantServer } from "./server";
import { makeIncoming } from "sidekick";
import type { ClientChannel, RealtimeClient } from "./realtime";


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

export type ListenResponse<T> = {
  type: "OK",
  listener: Listener<T>,
  resources: string[],
  unsubscribe: () => void,
} | {
  type: "ERROR",
  error: ProcedureError,
}


export class CovenantClient<
  P extends ProcedureMap,
  C extends ChannelMap,
  Context extends StandardSchemaV1,
  Data extends StandardSchemaV1
> {
  private covenant: Covenant<P, C, Context, Data>;
  private messenger: ClientMessenger;
  private listeners: Map<string, (() => Promise<void>)[]> = new Map();
  private realtime: RealtimeClient;


  constructor(covenant: Covenant<P, C, Context, Data>, messenger: ClientMessenger, realtime: RealtimeClient) {
    this.covenant = covenant;
    this.messenger = messenger;
    this.realtime = realtime;
  }

  private async call<K extends keyof P>(procedure: K, inputs: InferProcedureInputs<P[K]>): Promise<InferProcedureOutputs<P[K]>> {
    const req: ProcedureRequest = {
      procedure: String(procedure),
      inputs,
    }

    const outputSchema = this.covenant.procedures[procedure]?.output!;
    const res = await this.messenger.fetch(req);
    const body = await res.json();
    const responseSchema = getProcedureResponseSchema(outputSchema);

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

  async mutate<K extends MutationKey<P>>(procedure: K, inputs: InferProcedureInputs<P[K]>): Promise<InferProcedureOutputs<P[K]>> {
    const data = await this.call(procedure, inputs);

    if (data.result === "ERROR") {
      return data;
    }

    // we call this without awaiting so that it happens in the background
    //@ts-expect-error we know more than the typescript compiler here
    this.refetchResources(data.resources);

    return data;
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

  async localListen<K extends QueryKey<P>>(
    procedure: K,
    inputs: InferProcedureInputs<P[K]>,
    callback: Listener<InferProcedureOutputs<P[K]>>
  ): Promise<ListenResponse<InferProcedureOutputs<P[K]>>> {
    const schema = this.covenant.procedures[procedure]!;
    if (schema.type !== "query") {
      throw new Error("Tried to listen to a mutation which makes no sense");
    }
    const result = await this.call(procedure, inputs);

    if (result.result === "ERROR") {
      return {
        type: "ERROR",
        //@ts-ignore
        error: result.error,
      }
    }

    const listener = async () => {
      callback(await this.call(procedure, inputs));
    }

    // we also go ahead and call the listener to do an
    // initial fetch
    this.addListener(result.resources!, listener);
    listener();

    return {
      type: "OK",
      listener,
      resources: result.resources!,
      unsubscribe: () => {
        this.removeListener(result.resources!, listener);
      }
    }
  }

  async remoteListen<K extends QueryKey<P>>(
    procedure: K,
    inputs: InferProcedureInputs<P[K]>,
    callback: Listener<InferProcedureOutputs<P[K]>>,
  ): Promise<ListenResponse<
    InferProcedureOutputs<P[K]>
  >> {
    const result = await this.localListen(procedure, inputs, callback);

    if (result.type === "ERROR") {
      return result;
    }

    this.realtime.subscribeToResources(result.resources);

    return {
      type: "OK",
      listener: result.listener,
      resources: result.resources,
      unsubscribe: () => {
        this.realtime.unsubscribeFromResources(result.resources);
        result.unsubscribe();
      }
    };

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

  async sendChannelMessage() {
    // check if we are subscribed to the channel. If not, throw an erorr
    // send the message to the 
  }

  async connectTo(): Promise<ClientChannel> {
    // if we are already connected, return the ClientChannel
    // send connection
    // return error if it didn't work

    //@ts-ignore TODO
    return {}
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

export function directMessenger(server: CovenantServer<any, any, any, any, any>): ClientMessenger {
  return {
    fetch(request: ProcedureRequest): Promise<Response> {
      const req: Request = new Request({
        url: "http://localhost:3000?type=procedure",
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(request),
      })

      return server.handle(req);
    }
  }
}


export class SocketRealtimeClient implements RealtimeClient {
  url: string;
  socket: WebSocket;
  subscribedResources: Set<string> = new Set();

  constructor(url: string) {
    this.url = url;
    this.socket = new WebSocket(url);

    this.makeSocket();
  }


  private makeSocket() {
    this.socket = new WebSocket(this.url);

    this.socket.onopen = () => {
      // when we reopen we want to add all of the resources we had forgotten
      console.log("Reconnected!");
      this.socket.send(makeIncoming({
        type: "listen",
        resources: Array.from(this.subscribedResources),
      }));
    }
    this.socket.onclose = async () => {
      // TODO - add all subscriptions again after a disconnection
      console.log("Websocket disconnected. Reconnecting...");
      await new Promise(resolve => setTimeout(resolve, 5000));
      this.makeSocket();
    }
    this.socket.onmessage = (e) => {
      const data = e.data;
      console.log("On client recieved:")
      console.log(data);
      console.log(typeof data);
    }
  }

  private async waitForConnection() {
    if (this.socket.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const t = setTimeout(reject, 10000);
      this.socket.addEventListener("open", () => {
        clearTimeout(t);
        resolve()
      });
    });
  }

  async subscribeToResources(resources: string[]): Promise<void> {
    await this.waitForConnection();
    for (const r of resources) {
      this.subscribedResources.add(r);
    }

    console.log("sending subscribe message");
    this.socket.send(makeIncoming({
      type: "listen",
      resources,
    }))
  }

  async unsubscribeFromResources(resources: string[]): Promise<void> {
    await this.waitForConnection();

    for (const r of resources) {
      this.subscribedResources.delete(r);
    }

    this.socket.send(makeIncoming({
      type: "unlisten",
      resources,
    }));
  }
}
