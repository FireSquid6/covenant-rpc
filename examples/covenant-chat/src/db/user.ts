import { eq } from "drizzle-orm";
import { Database } from ".";
import type { PublicUser, User } from "./schema";
import type { Session } from "next-auth";
import { usersTable } from "./schema"
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { nextAuthConfig } from "@/lib/auth";


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

export async function forceAuthenticated(db: Database, redirectTo?: string): Promise<{ user: User, session: Session }> {
  const join = await getUserAndSession(db);

  if (!join || !join.user) {
    redirect(redirectTo ?? "/auth");
  }


  return join;
}

export async function getUserAndSession(db: Database): Promise<{ session: Session, user: User } | null> {
  const session = await getServerSession(nextAuthConfig);

  if (!session) {
    return null;
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, session.user.id))
  
  if (users.length !== 1) {
    return null;
  }

  return { user: users[0], session };
}
