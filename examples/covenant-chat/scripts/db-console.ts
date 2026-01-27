#!/usr/bin/env bun

import { db } from "@/lib/db";
import { serverTable, user, membershipTable, channelTable } from "@/lib/db/schema";
import { ArrayToMap, MaybePromise } from "@covenant/core/lib/utils";
import { eq } from "drizzle-orm";


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

const commands: Command<string[]>[] = [
  makeCommand("hello", {
    args: ["person"],
    fn: ({ person }) => {
      console.log(`Hello, ${person}!`);
    }
  }),
  makeCommand("createServer", {
    args: ["name"],
    fn: async ({ name }) => {
      const id = crypto.randomUUID();
      await db.insert(serverTable).values({
        id,
        name
      });
      console.log(`Created server "${name}" with ID: ${id}`);
    }
  }),
  makeCommand("joinServer", {
    args: ["email", "serverId"],
    fn: async ({ email, serverId }) => {
      const foundUser = await db.select().from(user).where(eq(user.email, email)).limit(1);
      if (foundUser.length === 0) {
        console.error(`User with email ${email} not found`);
        return;
      }
      
      const foundServer = await db.select().from(serverTable).where(eq(serverTable.id, serverId)).limit(1);
      if (foundServer.length === 0) {
        console.error(`Server with ID ${serverId} not found`);
        return;
      }

      await db.insert(membershipTable).values({
        userId: foundUser[0].id,
        serverId
      });
      console.log(`User ${email} joined server "${foundServer[0].name}"`);
    }
  }),
  makeCommand("createChannel", {
    args: ["name", "serverId"],
    fn: async ({ name, serverId }) => {
      const foundServer = await db.select().from(serverTable).where(eq(serverTable.id, serverId)).limit(1);
      if (foundServer.length === 0) {
        console.error(`Server with ID ${serverId} not found`);
        return;
      }

      const id = crypto.randomUUID();
      await db.insert(channelTable).values({
        id,
        name,
        serverId
      });
      console.log(`Created channel "${name}" in server "${foundServer[0].name}" with ID: ${id}`);
    }
  }),
  makeCommand("help", {
    args: [],
    fn: () => {
      for (const c of commands) {
        console.log(`${c.name}(${c.args.join(", ")})`);
      }
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

  const commandName = parts.shift()!;

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
  process.stdout.write("$ "); 
  for await (const line of console) {
    await processCommand(line, commands);
    process.stdout.write("\n$ "); 
  }
}

main();
