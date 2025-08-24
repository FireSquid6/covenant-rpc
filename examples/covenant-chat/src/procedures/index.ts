import { db } from "@/db";
import { User } from "@/db/schema";
import { covenant } from "@/lib/covenant";
import { emptyRealtimeConnection } from "covenant/realtime";
import { CovenantServer } from "covenant/server";
import { getUserAndSession } from "@/db/user";


export const covenantServer = new CovenantServer(
  covenant,
  {
    contextGenerator: async () => {
      const auth = await getUserAndSession(db);
      const user = auth?.user ?? null;
      return {
        user: user,
      }
    },
    derivation: ({ error, ctx }) => {
      return {
        forceAuthenticated: async (): Promise<User> => {
          const user = ctx.user;

          if (!user) {
            throw error("Not authenticated", 401);
          }

          return user;
        },
      }
    },
    realtimeConnection: emptyRealtimeConnection(),
  }
)


covenantServer.assertAllDefined();
