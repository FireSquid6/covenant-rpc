import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ProcedureMap, ChannelMap, Covenant, ProcedureDeclaration } from ".";
import { issuesToString, type Flatten, type Listener } from "./utils";
import { getProcedureResponseSchema, type ProcedureError, type ProcedureResponse } from "./response";
import type { ProcedureRequest } from "./request";
import type { CovenantServer } from "./server";
import { makeIncoming, outgoingMessageSchema, type ChannelMessage, type OutgoingMessage } from "sidekick";
import type { RealtimeClient } from "./realtime";
import { type MaybePromise } from "bun";
import type { ConnectionRequest, InferChannelInputs, InferChannelOutputs, InferChannelParams, InferConnectionRequest, LocalConnectionRequest } from "./channels";
import { getChannelTopicName } from "sidekick/handlers";


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

export type ListenResponse = {
  type: "OK",
  listener: () => MaybePromise<void>,
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
          message: `Output validation failed: ${issuesToString(validation.issues)}`,
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
  ): Promise<ListenResponse> {
    const schema = this.covenant.procedures[procedure]!;
    if (schema.type !== "query") {
      throw new Error("Tried to listen to a mutation which makes no sense");
    }
    const result = await this.call(procedure, inputs);

    if (result.result === "ERROR") {
      callback(result);
      return {
        type: "ERROR",
        //@ts-ignore
        error: result.error,
      }
    }

    const listener = async () => {
      console.log("Calling the listener");
      const res = await this.call(procedure, inputs);
      console.log("Calling the initial supplied thing")
      callback(res);
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
  ): Promise<ListenResponse> {
    const result = await this.localListen(procedure, inputs, callback);

    if (result.type === "ERROR") {
      return result;
    }

    this.realtime.subscribeToResources(result.resources, result.listener);

    return {
      type: "OK",
      listener: result.listener,
      resources: result.resources,
      unsubscribe: () => {
        this.realtime.unsubscribeFromResources(result.resources, result.listener);
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

  async sendChannelMessage<K extends keyof C>(
    channel: K,
    params: InferChannelParams<C[K]>,
    message: InferChannelInputs<C[K]>
  ) {
    // TODO: check if we are subscribed to the channel. If not, throw an erorr
    // maybe do that in the RealtimeClient actually

    console.log("sending message to the client's realtime");
    this.realtime.send({
      channel: String(channel),
      params,
      message
    });
  }

  async connectTo<N extends keyof C>(
    channelName: N,
    params: InferChannelParams<C[N]>,
    connection: InferConnectionRequest<C[N]>,
    callback: (
      outputs: InferChannelOutputs<C[N]>,
      params: InferChannelParams<C[N]>,
      channelName: N
    ) => MaybePromise<void>,
  ): Promise<() => void> {
    // if we are already connected, return the ClientChannel
    // send connection
    // return error if it didn't work
    const channel = this.covenant.channels[channelName]!;

    const listener = async (i: unknown) => {
      const validation = await channel.serverMessage["~standard"].validate(i);

      if (validation.issues) {
        // TODO - handle this error and proper channel error management in general
        throw new Error("I forgot to handle the error where we get the wrong resources");
      }

      // the typescript compiler can't see deep enough to know that outputs
      // is actually know. This is the problem with dealing with generic
      // inferrence
      const outputs = validation.value as InferChannelOutputs<C[N]>;
      await callback(outputs, params, channelName);
    }

    const request: LocalConnectionRequest = {
      channel: String(channelName),
      params,
      connectionRequest: connection,
    }

    const unsubscribe = await this.realtime.connect(request, listener)
    return () => {
      this.realtime.disconnect(request, listener);
      unsubscribe()
    };
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


// TODO - add the ability to handle errors from the websocket
export class SocketRealtimeClient implements RealtimeClient {
  url: string;
  socket: WebSocket;
  subscribedResources: Set<string> = new Set();
  subscribedChannelTopics: Set<string> = new Set();
  private resourceListeners: Map<string, (() => MaybePromise<void>)[]> = new Map();
  private channelListeners: Map<string, ((message: unknown) => MaybePromise<void>)[]> = new Map();

  constructor(url: string) {
    this.url = url;
    this.socket = new WebSocket(url);

    this.makeSocket();
  }


  private makeSocket() {
    this.socket = new WebSocket(this.url);

    this.socket.onopen = async () => {
      console.log("Reconnected!");
      // TODO - reconnect to all previously subscribed
    }
    this.socket.onclose = async () => {
      console.log("Websocket disconnected. Reconnecting...");
      await new Promise(resolve => setTimeout(resolve, 5000));
      this.makeSocket();
    }
    this.socket.onmessage = async (e) => {
      const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      console.log("Data:", data);
      const { data: message, success, error } = outgoingMessageSchema.safeParse(data);
      if (!success) {
        // TODO - error handling
        console.log("Error parsing message:");
        console.log(error);
        return;
      }

      await this.handleMessage(message);
    }
  }

  send(message: Omit<ChannelMessage, "type">): void {
    const msg: ChannelMessage = {
      type: "message",
      ...message,
    }

    console.log("sending message in the socket");
    this.socket.send(JSON.stringify(msg));
  }
  getSubscribedChannelTopics(): string[] {
    return Array.from(this.subscribedChannelTopics);
  }

  getSubscribedResources(): string[] {
    return Array.from(this.subscribedResources);
  }

  private async handleMessage(message: OutgoingMessage): Promise<void> {
    switch (message.type) {
      case "message":
        const msg = message.data;

        if (msg.type === "OK") {
          const topic = getChannelTopicName(msg.channel, msg.params);
          const cListeners = this.channelListeners.get(topic) ?? [];
          await Promise.all(cListeners.map(l => l(msg.message)));
        } else {
          // TODO - handle the error
          throw msg;
        }

        break;
      // TODO - keep list of all channels we are subscribed to
      // throw errors if we try to send a message on a non-subscribed channel
      // also keep track of all the things we are listening to
      case "listening":
        message.resources.map(r => this.subscribedResources.add(r));
        break;
      case "unlistening":
        message.resources.map(r => this.subscribedResources.delete(r));
        break;
      case "subscribed":
        const subscribedTopic = getChannelTopicName(message.channel, message.params);
        this.subscribedChannelTopics.add(subscribedTopic);
        break;
      case "unsubscribed":
        const unsubscribedTopic = getChannelTopicName(message.channel, message.params);
        this.subscribedChannelTopics.delete(unsubscribedTopic);
        break;
      case "error":
        // TODO - send the error somewhere
        console.log("Recieved error:");
        console.log(message.error);

        break;
      case "updated":
        console.log("calling listeners for", message.resource);
        const rListeners = this.resourceListeners.get(message.resource) ?? [];
        await Promise.all(rListeners.map(l => l()));
        break;
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

  async connect(request: ConnectionRequest, listener: (i: unknown) => MaybePromise<void>): Promise<() => void> {
    await this.waitForConnection();
    this.socket.send(makeIncoming({
      type: "subscribe",
      connectionRequest: request,
    }));

    const topic = getChannelTopicName(request.channel, request.params);
    this.addChannelListener(topic, listener);

    return () => {
      this.removeChannelListener(topic, listener);
    }
  }

  async disconnect(request: ConnectionRequest, listener: (i: unknown) => MaybePromise<void>): Promise<void> {
    await this.waitForConnection();
    const topic = getChannelTopicName(request.channel, request.params);
    this.removeChannelListener(topic, listener);


    if ((this.channelListeners.get(topic) ?? []).length < 0) {
      this.socket.send(makeIncoming({
        type: "unsubscribe",
        channel: request.channel,
        params: request.params,
      }))
    }
  }

  async subscribeToResources(resources: string[], listener: () => MaybePromise<void>): Promise<void> {
    await this.waitForConnection();
    for (const r of resources) {
      this.subscribedResources.add(r);
      this.addResourceListener(r, listener);
    }


    console.log("sending subscribe message");
    this.socket.send(makeIncoming({
      type: "listen",
      resources,
    }))
  }

  async unsubscribeFromResources(resources: string[], listener: () => MaybePromise<void>): Promise<void> {
    await this.waitForConnection();

    for (const r of resources) {
      this.subscribedResources.delete(r);
      this.removeResourceListener(r, listener);
    }

    this.socket.send(makeIncoming({
      type: "unlisten",
      resources,
    }));
  }

  private addResourceListener(resource: string, listener: () => MaybePromise<void>) {
    if (this.resourceListeners.get(resource) === undefined) {
      this.resourceListeners.set(resource, [listener]);
    } else {
      const current = this.resourceListeners.get(resource)!;
      current.push(listener);
      this.resourceListeners.set(resource, current);
    }
  }

  private removeResourceListener(resource: string, listener: () => MaybePromise<void>) {
    if (this.resourceListeners.get(resource) !== undefined) {
      const current = this.resourceListeners.get(resource)!;
      const newListeners = current.filter(l => l !== listener);
      this.resourceListeners.set(resource, newListeners);
    }
  }

  private addChannelListener(channel: string, listener: (i: unknown) => MaybePromise<void>) {
    if (this.channelListeners.get(channel) === undefined) {
      this.channelListeners.set(channel, [listener]);
    } else {
      const current = this.channelListeners.get(channel)!;
      current.push(listener);
      this.channelListeners.set(channel, current);
    }
  }

  private removeChannelListener(channel: string, listener: (i: unknown) => MaybePromise<void>) {
    if (this.channelListeners.get(channel) !== undefined) {
      const current = this.resourceListeners.get(channel)!;
      const newListeners = current.filter(l => l !== listener);
      this.resourceListeners.set(channel, newListeners);
    }
  }
}

export class EmptyRealtimeClient implements RealtimeClient {
  async connect(): Promise<() => void> {
    return () => { };
  }
  async disconnect(): Promise<void> { }
  async subscribeToResources(): Promise<void> { }
  async unsubscribeFromResources(): Promise<void> { }
  getSubscribedResources(): string[] {
    return []
  }
  getSubscribedChannelTopics(): string[] {
    return []
  }

  send(): void { }
}
