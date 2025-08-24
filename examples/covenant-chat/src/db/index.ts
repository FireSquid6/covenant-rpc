// this is the same as covenant todo

import fs from "fs";
import path from "path";
import { createClient } from "@libsql/client";
import { AppConfig, readConfigFromEnv } from "@/lib/config";
import { drizzle } from "drizzle-orm/libsql";

export function getDb(config: AppConfig) {
  if (config.dbType === "local") {
    fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  }

  const client = config.dbType === "remote" ? createClient({
    url: config.dbPath,
    authToken: config.dbToken,
  }) : createClient({
    url: `file:${config.dbPath}`,
  });

  return drizzle(client);
}

export type Database = ReturnType<typeof getDb>;

export function getDbFromEnv() {
  const config = readConfigFromEnv();
  return getDb(config);
}

export const db = getDbFromEnv();
