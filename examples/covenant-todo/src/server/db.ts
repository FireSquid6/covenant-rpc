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

  // Create todos table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

/**
 * Create a test user for development/testing
 * Username: testuser
 * Password: password
 */
export async function createTestUser() {
  const { users } = schema;

  // Check if test user already exists
  const existing = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.username, 'testuser'),
  });

  if (existing) {
    return;
  }

  // Create test user
  const userId = randomBytes(16).toString('hex');
  await db.insert(users).values({
    id: userId,
    username: 'testuser',
    password: 'password', // WARNING: In production, hash this!
    createdAt: new Date(),
  });

  console.log('Test user created: testuser / password');
}
