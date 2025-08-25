import { InferSelectModel } from "drizzle-orm";
import { int, sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";
import { v7 as uuidv7 } from "uuid";
import { createSelectSchema } from "drizzle-zod";
import { useSelectedLayoutSegment } from "next/navigation";
import { z } from "zod";


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

export const guildsTable = sqliteTable("guild", {
  id: text().notNull().unique().primaryKey(),
  name: text().notNull(),
});
export type Guild = InferSelectModel<typeof guildsTable>;
export const selectGuildSchema = createSelectSchema(guildsTable);

export const roomsTable = sqliteTable("room", {
  id: text().notNull().unique().primaryKey(),
  guild: text().notNull().references(() => guildsTable.id),
  name: text().notNull(),
  description: text().notNull(),
});
export type Room = InferSelectModel<typeof roomsTable>;

export const messagesTable = sqliteTable("message", {
  id: text().notNull().unique().primaryKey(),
  content: text().notNull(),
  sender: text().notNull().references(() => usersTable.id),
  room: text().notNull().references(() => roomsTable.id),
  // it's best not to use { mode: "date" } since that doesn't really serialize well
  // just format it as a date on the client side
  timestamp: int().notNull(),
});
export type Message = InferSelectModel<typeof messagesTable>;
export const selectMessageSchema = createSelectSchema(messagesTable);

export const rolesTable = sqliteTable("role", {
  id: text().notNull().unique().primaryKey(),
  guild: text().notNull().references(() => guildsTable.id),
  userId: text().notNull().references(() => usersTable.id),
  isAdmin: int({ mode: "boolean" }).notNull().default(false),
});
export type Role = InferSelectModel<typeof rolesTable>;

export const invitesTable = sqliteTable("invites", {
  code: text().notNull().unique().primaryKey(),
  guildId: text().notNull().references(() => guildsTable.id),
});

export const joinedTable = sqliteTable("joined", {
  userId: text().notNull().references(() => usersTable.id),
  guildId: text().notNull().references(() => guildsTable.id),
});


// invitations table
// channels table
// roles table
// messages table
