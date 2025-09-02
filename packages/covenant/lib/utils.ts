import type { StandardSchemaV1 } from "@standard-schema/spec";

export type MaybePromise<T> = T | Promise<T>;
export type Flatten<T> = { [k in keyof T]: T[k] } & {};
export type ArrayToMap<T extends readonly string[]> = { [k in T[number]]: string };



export type Result<T> = {
  success: true;
  data: T;
  error: null;
} | {
  success: false;
  data: null;
  error: Error
}

export type AsyncResult<T> = Promise<Result<T>>;


export function ok<T>(t: T): Result<T> {
  return {
    data: t,
    success: true,
    error: null,
  }
}

export function err(error: Error): Result<any> {
  return {
    data: null,
    success: false,
    error,
  }
}

export function issuesToString(issues: readonly StandardSchemaV1.Issue[]): string {
  const strs: string[] = []

  for (const issue of issues) {
    strs.push(`${issue.path}: ${issue.message}`);
  }


  return strs.join(", ");
}



export type PubsubListener<T> = (t: T) => MaybePromise<void>;

export class MultiTopicPubsub<T> {
  private listenerMap: Map<string, PubsubListener<T>[]> = new Map();
  
  subscribe(topic: string, listener: PubsubListener<T>) {
    if (this.listenerMap.has(topic)) {
      const newListeners = [...this.listenerMap.get(topic)!, listener];
      this.listenerMap.set(topic, newListeners);
    } else {
      this.listenerMap.set(topic, [listener]);
    }
  }

  unsubscribe(topic: string, listener: PubsubListener<T>) {
    if (this.listenerMap.has(topic)) {
      const listeners = this.listenerMap.get(topic)!;
      this.listenerMap.set(topic, listeners.filter(l => l !== listener));
    }
  }

  async publish(topic: string, data: T) {
    const listeners = this.listenerMap.get(topic) ?? [];

    const promises = listeners.map(l => l(data));
    await Promise.all(promises);
  }
}
