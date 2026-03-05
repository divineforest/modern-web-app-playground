import { randomBytes } from 'node:crypto';
import type { Database } from '../../src/db/index.js';
import { db, sessions } from '../../src/db/index.js';
import type { NewSession } from '../../src/db/schema.js';

/**
 * Build test session data with default values that can be overridden
 */
function buildTestSessionData(overrides: Partial<NewSession> = {}): NewSession {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const sessionData: NewSession = {
    userId: overrides.userId ?? '00000000-0000-0000-0000-000000000001',
    token: overrides.token ?? randomBytes(32).toString('hex'),
    expiresAt: overrides.expiresAt ?? expiresAt,
  };

  if (overrides.id) {
    return { ...sessionData, id: overrides.id };
  }

  return sessionData;
}

/**
 * Create a test session record in the database
 */
export async function createTestSession(
  overrides: Partial<NewSession> = {},
  database: Database = db
) {
  const sessionData = buildTestSessionData(overrides);
  const results = await database.insert(sessions).values(sessionData).returning();

  if (!results[0]) {
    throw new Error('Failed to create test session');
  }

  return results[0];
}
