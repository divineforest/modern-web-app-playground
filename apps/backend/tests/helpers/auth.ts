import argon2 from 'argon2';
import type { Database } from '../../src/db/index.js';
import { db } from '../../src/db/index.js';
import { createTestSession } from '../factories/sessions.js';
import { createTestUser } from '../factories/users.js';

/**
 * Create a test user with session and return the session token
 */
export async function createAuthenticatedUser(
  email = 'test@example.com',
  password = 'password123',
  database: Database = db
): Promise<{ userId: string; sessionToken: string }> {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = await createTestUser(
    {
      email,
      password: passwordHash,
      salt: '',
    },
    database
  );

  const session = await createTestSession(
    {
      userId: user.id,
    },
    database
  );

  return {
    userId: user.id,
    sessionToken: session.token,
  };
}
