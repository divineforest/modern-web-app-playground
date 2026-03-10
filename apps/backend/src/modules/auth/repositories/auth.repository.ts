import { eq } from 'drizzle-orm';
import type { Database } from '../../../db/index.js';
import { db, sessions, users } from '../../../db/index.js';
import type { NewUser, User } from '../../../db/schema.js';

/**
 * Find user by email address
 */
export async function findUserByEmail(
  email: string,
  database: Database = db
): Promise<User | null> {
  const results = await database.select().from(users).where(eq(users.email, email));
  return results[0] || null;
}

/**
 * Create a new user record
 */
export async function createUser(data: NewUser, database: Database = db): Promise<User> {
  const results = await database.insert(users).values(data).returning();

  if (!results[0]) {
    throw new Error('Failed to create user');
  }

  return results[0];
}

/**
 * Create a new session record
 */
export async function createSession(
  userId: string,
  token: string,
  expiresAt: Date,
  database: Database = db
) {
  const results = await database
    .insert(sessions)
    .values({
      userId,
      token,
      expiresAt,
    })
    .returning();

  if (!results[0]) {
    throw new Error('Failed to create session');
  }

  return results[0];
}

/**
 * Find session by token with joined user data
 */
export async function findSessionByToken(token: string, database: Database = db) {
  const results = await database
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token));

  return results[0] || null;
}

/**
 * Delete session by token
 */
export async function deleteSessionByToken(token: string, database: Database = db): Promise<void> {
  await database.delete(sessions).where(eq(sessions.token, token));
}

/**
 * Update session expiry and last used timestamp (sliding window)
 */
export async function updateSessionExpiry(
  sessionId: string,
  expiresAt: Date,
  lastUsedAt: Date,
  database: Database = db
): Promise<void> {
  await database
    .update(sessions)
    .set({
      expiresAt,
      lastUsedAt,
    })
    .where(eq(sessions.id, sessionId));
}

/**
 * Find user by ID
 */
export async function findUserById(userId: string, database: Database = db): Promise<User | null> {
  const results = await database.select().from(users).where(eq(users.id, userId));
  return results[0] || null;
}
