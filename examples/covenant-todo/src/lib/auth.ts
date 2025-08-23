import { readConfigFromEnv } from "./config"
import { accountsTable, sessionsTable, usersTable, verificationTokensTable } from "@/db/schema";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { DefaultSession, NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { db } from "@/db";

const config = readConfigFromEnv();

declare module "next-auth" {
  interface Session {
    user: {
      id: string
    } & DefaultSession["user"];
  }
}

export const nextAuthConfig = {
  providers: [
    GithubProvider({
      clientId: config.githubClientId,
      clientSecret: config.githubClientSecret,
    })
  ],
  adapter: DrizzleAdapter(db, {
    usersTable: usersTable,
    accountsTable: accountsTable,
    sessionsTable: sessionsTable,
    verificationTokensTable: verificationTokensTable,
  }),
  callbacks: {
    async session({ session, user }) {
      if (session?.user && user?.id) {
        session.user.id = user.id;
      }

      return session;
    }
  },
  session: {
    strategy: "database",
  },
} satisfies NextAuthOptions

