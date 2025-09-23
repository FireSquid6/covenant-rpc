import { eq } from "drizzle-orm";
import { Database } from ".";
import type { PublicUser, User } from "./schema";
import { user as usersTable } from "./schema"
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";


export async function findUserByEmail(db: Database, email: string): Promise<User | null> {
  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1)

  return users[0] ?? null;
}

export function userToPublic(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    image: user.image, 
  }
}

export async function forceAuthenticated(redirectTo?: string) {
  const join = await getUserAndSession();

  if (!join || !join.user) {
    redirect(redirectTo ?? "/auth");
  }


  return join;
}

export async function getUserAndSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });


  if (!session) {
    return null;
  }

  return session;
}
