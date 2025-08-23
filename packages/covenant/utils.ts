import type { StandardSchemaV1 } from "@standard-schema/spec";
import { z } from "zod";

export type MaybePromise<T> = Promise<T> | T;
export type Flatten<T> = { [key in keyof T]: T[key] } & {};



export type Listener<T> = (s: T) => void | Promise<void>;

export class Observable<T> {
  private state: T | undefined;
  private listeners: Listener<T>[] = [];

  constructor(state?: T) {
    this.state = state;
  }

  // returns a function to unlisten
  listen(l: Listener<T>): () => void {
    this.listeners.push(l);
    return () => this.unlisten(l);
  }

  unlisten(l: Listener<T>) {
    this.listeners.filter(listener => listener === l);
  }

  peek(): T | undefined {
    return this.state;
  }

  update(s: T) {
    this.state = s;
    this.listeners.map(l => l(s));
  }
}

// this is technically a quite ugly O(n*m) but that's not really a big deal since if there
// are more than like 3 resources being touched by a single mutation there might be bigger
// issues
//
// this is an ugly function in general. We will need to change it.
export function hasbeenModified(mutatedResources: string[], queriedResource: string[]): boolean {
  for (const mutated of mutatedResources) {
    for (const queried of queriedResource) {
      if (globMatch(mutated, queried)) {
        return true;
      }
    }
  }

  return false;
}

function globMatch(pattern: string, testString: string) {
  if (!pattern.includes("*")) {
    return pattern === testString;
  }

  const regexPattern = pattern
    .replace(/\*\*/g, "DOUBLE_ASTERISK_PLACEHOLDER")
    .replace(/\*/g, "[^/]*")
    .replace(/DOUBLE_ASTERISK_PLACEHOLDER/g, ".*")
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&");

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(testString);
}

export type ArrayToMap<T extends readonly string[]> = { [k in T[number]]: string };

export function createMappedSchema<T extends readonly string[]>(keys: T): z.ZodObject<{
  [k in keyof T[number]]: z.ZodString
}> {
  return z.object(Object.fromEntries(keys.map(k => [k, z.string()]))) as z.ZodObject<{
    [k in keyof T[number]]: z.ZodString
  }>
}

export function issuesToString(issues: readonly StandardSchemaV1.Issue[]): string {
  const strs: string[] = []

  for (const issue of issues) {
    strs.push(`${issue.path}: ${issue.message}`);
  }


  return strs.join(", ");
}


export function stringToReadableStream(str: string, chunkSize = str.length) {
  let index = 0;
  
  return new ReadableStream({
    start() {
      // Optional: You can enqueue initial data here if needed
    },
    
    pull(controller) {
      // If we've reached the end of the string, close the stream
      if (index >= str.length) {
        controller.close();
        return;
      }
      
      // Get the next chunk
      const chunk = str.slice(index, index + chunkSize);
      index += chunk.length;
      
      // Encode the string chunk as Uint8Array and enqueue it
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(chunk));
    },
    
    cancel(reason) {
      // Handle stream cancellation if needed
      console.log('Stream cancelled:', reason);
    }
  });
}
