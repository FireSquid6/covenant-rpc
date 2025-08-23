import { defineConfig } from "drizzle-kit";

console.log(process.env.DB_PATH);

export default defineConfig({
  schema: "src/db/schema.ts",
  dialect: "turso",
  out: "drizzle/remote",
  dbCredentials: {
    url: process.env.DB_PATH!,
    authToken: process.env.DB_TOKEN!,
  }
})
