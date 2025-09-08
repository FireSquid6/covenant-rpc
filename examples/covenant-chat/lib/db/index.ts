import { createClient } from "@libsql/client";
import { assertReadFromEnv } from "../utils";
import fs from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/libsql";



const dbType = assertReadFromEnv("DB_TYPE");
const dbPath = assertReadFromEnv("DB_PATH");


if (dbType === "local") {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}


const client = dbType === "remote" ? createClient({
  url: dbPath,
  authToken: process.env.DB_AUTH_TOKEN,
}) : createClient({
  url: `file:${dbPath}`,
});




export const db = drizzle(client);
export type Database = typeof db;
