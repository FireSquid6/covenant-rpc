#!/usr/bin/env bun

import { db } from "@/lib/db";
import { ArrayToMap, MaybePromise } from "@covenant/rpc/utils";


export interface Command<A extends readonly string[]> {
  name: string;
  args: A;
  fn: (args: ArrayToMap<A>) => MaybePromise<void>;
}

function makeCommand<A extends readonly string[]>(
  name: string, { args, fn }: {
    args: A,
    fn: (args: ArrayToMap<A>) => MaybePromise<void>,
  }): Command<A> {
  return {
    name,
    args,
    fn,
  }
}

const commands: Command<any>[] = [
  makeCommand("hello", {
    args: ["person"],
    fn: ({ person }) => {
      console.log(`Hello, ${person}!`);
    }
  })
]



function splitQuoted(s: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ' ' && !inQuotes) {
      if (current.length > 0) {
        result.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  
  if (current.length > 0) {
    result.push(current);
  }
  
  return result;
}

function parseArgs(args: string[]): Record<string, string> | null {
  const record: Record<string, string> = {};
  
  for (const a of args) {
    const split = a.split("=");
    if (split.length < 2) {
      console.error(`Failed to parse arg ${a}`);
      return null;
    }

    const key = split.shift()!;
    const val = split.join("=");

    record[key] = val;
  }

  return record;
}

function validateArgs(keys: string[], args: Record<string, string>): boolean {
   for (const k of keys) {
     if (args[k] === undefined) {
       console.error(`Missing argument ${k}`);
       return false;
     }
   }

   return true;
}

async function processCommand(line: string, commands: Command<any>[]) {
  const parts = splitQuoted(line);
  if (parts.length === 0) {
    console.error("Must input command");
    return;
  }

  const commandName = parts[0]!;

  const command = commands.find(c => c.name === commandName);
  if (!command) {
    console.error(`Command ${commandName} not found`);
    return;
  }

  const args = parseArgs(parts);
  if (args === null) {
    return;
  }

  const valid = validateArgs(command.args, args);
  if (!valid) {
    return;
  }
  
  await command.fn(args);
}


async function main() {
  for await (const line of console) {
    await processCommand(line, commands);
  }
}

main();
