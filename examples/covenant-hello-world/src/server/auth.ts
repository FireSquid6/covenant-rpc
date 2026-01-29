import { eq } from 'drizzle-orm';
import { db } from './db';
import { users, sessions } from '../../drizzle/schema';
import { randomBytes } from 'crypto';

/**
 * Authentication utilities for the hello world example.
 *
 * NOTE: This is a simple demonstration. In production:
 * - Hash passwords with bcrypt/argon2
 * - Use secure token generation
 * - Implement token expiration
 * - Add rate limiting
 */

/**
 * Generate a random auth token
 */
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Validate username and password, return user if valid
 */
export async function validateCredentials(
  username: string,
  password: string
): Promise<{ id: string; username: string } | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!user) {
    return null;
  }

  // In production, use bcrypt.compare() or similar
  if (user.password !== password) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
  };
}

/**
 * Create a new session and return the token
 */
export async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const sessionId = randomBytes(16).toString('hex');

  // Create session that expires in 24 hours
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    token,
    createdAt: new Date(),
    expiresAt,
  });

  return token;
}

/**
 * Validate a token and return the associated user
 */
export async function validateToken(
  token: string
): Promise<{ id: string; username: string } | null> {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.token, token),
  });

  if (!session) {
    return null;
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    return null;
  }

  // Get user
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
  };
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  // Expect format: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}
