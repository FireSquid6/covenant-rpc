import type { ChannelMap, Covenant, ProcedureMap } from ".";
import type { ClientToServerConnection, ClientToSidekickConnection } from "./interfaces";
import type { InferProcedureInputs, InferProcedureOutputs, InferProcedureResult } from "./procedure";
import { issuesToString } from "./utils";

export type MutationKey<P extends ProcedureMap> = { [k in keyof P]: P[k]["type"] extends "mutation" ? k : never }[keyof P]
export type QueryKey<P extends ProcedureMap> = {
  [k in keyof P]: P[k]["type"] extends "query" ? k : never
}[keyof P]

export type Listener<T> = (s: T) => void | Promise<void>;

export class CovenantClient<
  P extends ProcedureMap,
  C extends ChannelMap,
> {
  private covenant: Covenant<P, C>;
  private serverConnection: ClientToServerConnection;
  private sidekickConnection: ClientToSidekickConnection;
  private listeners: Map<string, (() => Promise<void>)[]> = new Map();
  private remoteListenersCount: Map<string, number> = new Map();

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
          message: `Improper response from server: ${issuesToString(validation.issues)}`,
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
