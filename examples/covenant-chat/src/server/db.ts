import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../../drizzle/schema';
import { randomBytes } from 'crypto';

/**
 * Database connection using better-sqlite3 driver
 */
const sqlite = new Database('./data.db');
export const db = drizzle(sqlite, { schema });

/**
 * Initialize the database by creating tables
 */
export function initializeDatabase() {
  // Create users table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // Create sessions table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create servers table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create server_members table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS server_members (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      joined_at INTEGER NOT NULL,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create channels table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    )
  `);

  // Create messages table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

/**
 * Create test users and sample data for development/testing
 * Users: alice/password, bob/password
 */
export async function createTestData() {
  const { users, servers, serverMembers, channels } = schema;

  // Check if test users already exist
  const existingAlice = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.username, 'alice'),
  });

  if (existingAlice) {
    return; // Test data already exists
  }

  // Create test users
  const aliceId = randomBytes(16).toString('hex');
  const bobId = randomBytes(16).toString('hex');

  await db.insert(users).values([
    {
      id: aliceId,
      username: 'alice',
      password: 'password', // WARNING: In production, hash this!
      createdAt: new Date(),
    },
    {
      id: bobId,
      username: 'bob',
      password: 'password',
      createdAt: new Date(),
    },
  ]);

  // Create a test server owned by Alice
  const serverId = randomBytes(16).toString('hex');
  await db.insert(servers).values({
    id: serverId,
    name: 'Test Server',
    ownerId: aliceId,
    createdAt: new Date(),
  });

  // Add both users as members
  await db.insert(serverMembers).values([
    {
      id: randomBytes(16).toString('hex'),
      serverId: serverId,
      userId: aliceId,
      joinedAt: new Date(),
    },
    {
      id: randomBytes(16).toString('hex'),
      serverId: serverId,
      userId: bobId,
      joinedAt: new Date(),
    },
  ]);

  // Create a test channel
  const channelId = randomBytes(16).toString('hex');
  await db.insert(channels).values({
    id: channelId,
    serverId: serverId,
    name: 'general',
    createdAt: new Date(),
  });

  console.log('Test data created:');
  console.log('  Users: alice/password, bob/password');
  console.log('  Server: Test Server');
  console.log('  Channel: general');
}
