import { InferSelectModel } from "drizzle-orm";
import { int, sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";
import { v7 as uuidv7 } from "uuid";
import { createSelectSchema } from "drizzle-zod";


export const usersTable = sqliteTable("user", {
  id: text("id").unique().primaryKey().$defaultFn(() => uuidv7()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: int("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
});

export const selectUserSchema = createSelectSchema(usersTable);
export type User = InferSelectModel<typeof usersTable>;
export type PublicUser = Omit<User,  "email" | "emailVerified">;

export const accountsTable = sqliteTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: text("type").$type<"oauth" | "email" | "oidc">().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: int("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
    refresh_token_expires_in: text("refresh_token_expires_in"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
)
export const sessionsTable = sqliteTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  expires: int("expires", { mode: "timestamp_ms" }).notNull(),
});

export const selectSessionSchema = createSelectSchema(sessionsTable);
export type DatabaseSession = InferSelectModel<typeof sessionsTable>;

export const verificationTokensTable = sqliteTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: int("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (verificationToken) => ({
    compositePk: primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  })
)
export type VerificationToken = InferSelectModel<typeof verificationTokensTable>;
 
export const authenticatorsTable = sqliteTable(
  "authenticator",
  {
    credentialID: text("credentialID").notNull().unique(),
    userId: text("userId")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    providerAccountId: text("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: int("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: int("credentialBackedUp", {
      mode: "boolean",
    }).notNull(),
    transports: text("transports"),
  },
  (authenticator) => ({
    compositePK: primaryKey({
      columns: [authenticator.userId, authenticator.credentialID],
    }),
  })
)

export type Authenticator = InferSelectModel<typeof authenticatorsTable>;

export const resetTable = sqliteTable("resets", {
  id: text().notNull().unique().primaryKey(),
  username: text().notNull().references(() => usersTable.id),
  expiresAt: int({ mode: "timestamp_ms" }).notNull(),
  key: text().notNull(),
});
export type ResetToken = InferSelectModel<typeof resetTable>;

export const todosTable = sqliteTable("todo", {
  id: text().notNull().unique().primaryKey(),
  userId: text().notNull().references(() => usersTable.id),
  completed: int({ mode: "boolean" }).notNull().default(false),
  text: text().notNull(),
  createdAt: int().notNull().default(Date.now()),
  lastUpdated: int().notNull().default(Date.now()),
});


export type Todo = InferSelectModel<typeof todosTable>;
export const todosSelectSchema = createSelectSchema(todosTable);
