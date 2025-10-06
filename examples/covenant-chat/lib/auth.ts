import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db"; 
import { assertReadFromEnv } from "./utils";
import * as schema from "@/lib/db/schema";


export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      ...schema
    }
  }),
  socialProviders: {
    github: {
      clientId: assertReadFromEnv("GITHUB_CLIENT_ID"),
      clientSecret: assertReadFromEnv("GITHUB_CLIENT_SECRET"),
    }
  }
});
