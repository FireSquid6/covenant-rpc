import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

/**
 * Users table - stores user accounts
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(), // WARNING: In production, hash this!
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Sessions table - stores auth tokens
 */
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Servers table - stores Discord-like servers
 */
export const servers = sqliteTable('servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Server members table - many-to-many relationship between users and servers
 */
export const serverMembers = sqliteTable('server_members', {
  id: text('id').primaryKey(),
  serverId: text('server_id')
    .notNull()
    .references(() => servers.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Channels table - stores channels within servers
 */
export const channels = sqliteTable('channels', {
  id: text('id').primaryKey(),
  serverId: text('server_id')
    .notNull()
    .references(() => servers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Messages table - stores chat messages
 */
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  channelId: text('channel_id')
    .notNull()
    .references(() => channels.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Relations for Drizzle ORM query builder
 */
export const serverMembersRelations = relations(serverMembers, ({ one }) => ({
  server: one(servers, {
    fields: [serverMembers.serverId],
    references: [servers.id],
  }),
  user: one(users, {
    fields: [serverMembers.userId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id],
  }),
}));
