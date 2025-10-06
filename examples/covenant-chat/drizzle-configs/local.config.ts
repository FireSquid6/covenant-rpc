import { defineConfig } from "drizzle-kit";


export default defineConfig({
  schema: "lib/db/schema.ts",
  dialect: "turso",
  out: "drizzle/local",
  dbCredentials: {
    url: "localdb/db.sqlite",
  }
})
