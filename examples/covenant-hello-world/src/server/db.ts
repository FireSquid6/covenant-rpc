import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../../drizzle/schema';
import path from 'path';

// Create database connection
const sqlite = new Database(path.join(process.cwd(), 'data.db'));

// Create drizzle instance
export const db = drizzle(sqlite, { schema });

// Helper to initialize the database with tables
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
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
}

// Helper to create a test user
export function createTestUser() {
  const userId = 'test-user-1';
  const username = 'testuser';
  const password = 'password123'; // In production, this should be hashed

  try {
    sqlite
      .prepare(
        'INSERT OR IGNORE INTO users (id, username, password, created_at) VALUES (?, ?, ?, ?)'
      )
      .run(userId, username, password, Date.now());

    console.log('Test user created (or already exists):', username);
  } catch (error) {
    console.error('Error creating test user:', error);
  }
}
