import { CovenantServer } from "@covenant/rpc/server";
import { covenant } from "./covenant";
import { httpServerToSidekick } from "@covenant/rpc/interfaces/http";
import { assertReadFromEnv } from "./utils";
import { defineAll } from "./definitions";
import { getUserAndSession } from "./db/user";

const sidekickSecret = assertReadFromEnv("SIDEKICK_SECRET");
const sidekickUrl = assertReadFromEnv("NEXT_PUBLIC_SIDEKICK_URL");

export const server = new CovenantServer(covenant, {
  contextGenerator: async () => {
    const auth = await getUserAndSession();

    return {
      user: auth?.user ?? null,
      session: auth?.session ?? null,
    }
  },
  derivation: ({ ctx, error }) => {
    return {
      forceAuthenticated: () => {
        if (!ctx.user || !ctx.session) {
          throw error("Not logged in", 401);
        }

        return { user: ctx.user, session: ctx.session };
      }
    }
  },
  sidekickConnection: httpServerToSidekick(sidekickUrl, sidekickSecret),
});

defineAll();
