import type { ChannelMap, Covenant, ProcedureMap } from "@covenant-rpc/core";
import type { InferChannelConnectionContext, InferChannelConnectionRequest, InferChannelParams, InferChannelServerMessage, InferChannelClientMessage } from "@covenant-rpc/core/channel";
import type { ClientToServerConnection, ClientToSidekickConnection } from "@covenant-rpc/core/interfaces";
import type { InferProcedureInputs, InferProcedureOutputs, InferProcedureResult } from "@covenant-rpc/core/procedure";
import { issuesToString } from "@covenant-rpc/core/utils";

export type MutationKey<P extends ProcedureMap> = { [k in keyof P]: P[k]["type"] extends "mutation" ? k : never }[keyof P]
export type QueryKey<P extends ProcedureMap> = {
  [k in keyof P]: P[k]["type"] extends "query" ? k : never
}[keyof P]

export type Listener<T> = (s: T) => void | Promise<void>;

type ChannelConnectionResult<E> =
  | { success: true; token: string; error: null }
  | { success: false; token: null; error: E };

function getChannelKey(channel: string, params: Record<string, string>): string {
  const paramStr = Object.keys(params)
    .sort()
    .map(k => `${k}:${params[k]}`)
    .join(",");
  return `${channel}/${paramStr}`;
}

export class CovenantClient<
  P extends ProcedureMap,
  C extends ChannelMap,
> {
  private covenant: Covenant<P, C>;
  private serverConnection: ClientToServerConnection;
  private sidekickConnection: ClientToSidekickConnection;
  private listeners: Map<string, (() => Promise<void>)[]> = new Map();
  private remoteListenersCount: Map<string, number> = new Map();
  private channelSubscriptions: Map<string, Listener<any>[]> = new Map();
  private pendingSendPromises: Map<string, { resolve: () => void; reject: (error: Error) => void }> = new Map();
  private sendCounter: number = 0;

  constructor(
    covenant: Covenant<P, C>,
    { serverConnection, sidekickConnection }: {
      serverConnection: ClientToServerConnection,
      sidekickConnection: ClientToSidekickConnection
    }
  ) {
    this.covenant = covenant;
    this.serverConnection = serverConnection;
    this.sidekickConnection = sidekickConnection;

    this.sidekickConnection.onMessage(async (message) => {
      if (message.type === "message") {
        // Route message to channel subscribers
        const key = getChannelKey(message.channel, message.params);
        const callbacks = this.channelSubscriptions.get(key) || [];
        for (const callback of callbacks) {
          await callback(message.data);
        }
      } else if (message.type === "updated") {
        // Handle resource updates
        await this.refetchResources([message.resource]);
      } else if (message.type === "error") {
        // Handle errors - resolve any pending send promises with error
        const pendingKeys = Array.from(this.pendingSendPromises.keys());
        for (const key of pendingKeys) {
          const pending = this.pendingSendPromises.get(key);
          if (pending) {
            this.pendingSendPromises.delete(key);
            pending.reject(new Error(message.error.message));
          }
        }
      }
    })
  }


  private async call<K extends keyof P>(
    procedure: K,
    inputs: InferProcedureInputs<P[K]>
  ): Promise<InferProcedureResult<P[K]>> {
    const result = await this.serverConnection.runProcedure({
      procedure: String(procedure),
      inputs: inputs,
    });

    if (result.status === "ERR") {
      return {
        success: false,
        data: null,
        resources: null,
        error: result.error,
      }
    }

    const declaration = this.covenant.procedures[procedure]!;
    const validation = await declaration.output["~standard"].validate(result.data);

    if (validation.issues) {
      return {
        success: false,
        data: null,
        resources: null,
        error: {
          code: 500,
          message: `Improper response from server from procedure ${String(procedure)}: ${issuesToString(validation.issues)}`,
        }
      }
    }

    return {
      success: true,
      error: null,
      // typescript isn't smart enough here but we still love it
      data: validation.value as InferProcedureOutputs<P[K]>,
      resources: result.resources,
    }
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

  async mutate<K extends MutationKey<P>>(
    procedure: K,
    inputs: InferProcedureInputs<P[K]>
  ): Promise<InferProcedureResult<P[K]>> {
    const result = await this.call(procedure, inputs);

    if (result.success === false) {
      return result;
    }

    await this.refetchResources(result.resources);

    return result;
  }

  async connect<K extends keyof C>(
    channelName: K,
    params: InferChannelParams<C[K]>,
    data: InferChannelConnectionRequest<C[K]>
  ): Promise<ChannelConnectionResult<any>> {
    const response = await this.serverConnection.sendConnectionRequest({
      channel: String(channelName),
      params: params as Record<string, string>,
      data,
    });

    if (response.result.type !== "OK") {
      return {
        success: false,
        token: null,
        error: response.result.error,
      };
    }

    return {
      success: true,
      token: response.result.token,
      error: null,
    };
  }

  async send<K extends keyof C>(
    channelName: K,
    params: InferChannelParams<C[K]>,
    token: string,
    data: InferChannelClientMessage<C[K]>
  ): Promise<void> {
    const sendId = `send-${this.sendCounter++}`;

    return new Promise<void>((resolve, reject) => {
      this.pendingSendPromises.set(sendId, { resolve, reject });

      // Send the message
      this.sidekickConnection.sendMessage({
        type: "send",
        token,
        channel: String(channelName),
        params: params as Record<string, string>,
        data,
      });

      // Set a timeout to auto-resolve if no error comes back
      setTimeout(() => {
        const pending = this.pendingSendPromises.get(sendId);
        if (pending) {
          this.pendingSendPromises.delete(sendId);
          resolve();
        }
      }, 100); // Wait 100ms for potential errors
    });
  }

  async subscribe<K extends keyof C>(
    channelName: K,
    params: InferChannelParams<C[K]>,
    token: string,
    callback: Listener<InferChannelServerMessage<C[K]>>
  ): Promise<() => void> {
    const key = getChannelKey(String(channelName), params as Record<string, string>);

    // Add callback to subscriptions
    if (!this.channelSubscriptions.has(key)) {
      this.channelSubscriptions.set(key, []);
    }
    this.channelSubscriptions.get(key)!.push(callback);

    // Subscribe to channel via sidekick
    this.sidekickConnection.sendMessage({
      type: "subscribe",
      token,
    });

    // Return unsubscribe function
    return () => {
      const callbacks = this.channelSubscriptions.get(key) || [];
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
      if (callbacks.length === 0) {
        this.channelSubscriptions.delete(key);
      }

      // Unsubscribe from channel via sidekick
      this.sidekickConnection.sendMessage({
        type: "unsubscribe",
        token,
      });
    };
  }


  listen<K extends QueryKey<P>>(
    procedure: K,
    inputs: InferProcedureInputs<P[K]>,
    callback: Listener<InferProcedureResult<P[K]>>,
    remote: boolean = false,
  ): () => void {
    const listener = async () => {
      const res = await this.call(procedure, inputs);
      callback(res);
    }

    const unsubscribe = () => {
      const removed = this.removeListener(listener);
      if (remote) {
        for (const r of removed) {
          this.decreateRemoteCount(r);
        }
        this.cleanRemoteListeners();
      }
    }

    // we call the promise "in the background" so that this can be
    // a synchronous function
    const p = async () => {
      const res = await this.call(procedure, inputs);
      callback(res);

      // we only add the listener if it's a non-error response. It is
      // up to the library user to ensure that errors are handled
      if (res.error) {
        return;
      }

      this.addListener(res.resources, listener);
      if (remote) {
        this.sidekickConnection.sendMessage({
          type: "listen",
          resources: res.resources,
        });
        for (const r of res.resources) {
          this.increaseRemoteCount(r);
        }
      }
    }
    p();

    return unsubscribe;
  }

  private addListener(resources: string[], listener: () => Promise<void>, isRemote: boolean = true) {
    // TODO - remote listeners
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


  // this is how we track which listeners are depending on a remote resource and which
  private removeListener(listener: () => Promise<void>): string[] {
    const removed: string[] = [];
    for (const r of this.listeners.keys()) {
      const currentListeners = this.listeners.get(r)!;

      // minor optimization?
      if (currentListeners.find(l => l === listener) === undefined) {
        continue;
      }
      removed.push(r);

      const newListeners = currentListeners.filter(l => l !== listener);
      this.listeners.set(r, newListeners);
    }
    return removed;
  }

  private increaseRemoteCount(resource: string) {
    if (this.remoteListenersCount.has(resource)) {
      const c = this.remoteListenersCount.get(resource)!;
      this.remoteListenersCount.set(resource, c + 1)
    } else {
      this.remoteListenersCount.set(resource, 1);
    }
  }
  private decreateRemoteCount(resource: string) {
    if (this.remoteListenersCount.has(resource)) {
      const c = this.remoteListenersCount.get(resource)!;
      if (c === 0) {
        throw new Error("Internal covenant error (not your fault unless you are developing covenant): Tried to reduce count for resource already at 0. Please report a bug.")
      }
      this.remoteListenersCount.set(resource, c - 1)
    } else {
      throw new Error("Internal covenant error (not your fault unless you are developing covenant): Tried to reduce count for resource with no remote subscriptions. Please report a bug.");
    }
  }

  private cleanRemoteListeners() {
    const unlistenTo: string[] = [];
    for (const k of this.remoteListenersCount.keys()) {
      const c = this.remoteListenersCount.get(k)!;

      if (c === 0) {
        unlistenTo.push(k);
      }
    }

    this.sidekickConnection.sendMessage({
      type: "unlisten",
      resources: unlistenTo,
    })
  }
}
