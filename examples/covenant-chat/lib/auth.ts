import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db"; 
import { assertReadFromEnv } from "./utils";


export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  socialProviders: {
    github: {
      clientId: assertReadFromEnv("GITHUB_CLIENT_ID"),
      clientSecret: assertReadFromEnv("GITHUB_CLIENT_SECRET"),
    }
  }
});
