import argon2 from 'argon2';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestSession } from '../../../tests/factories/sessions.js';
import { createTestUser } from '../../../tests/factories/users.js';
import { buildTestApp } from '../../app.js';
import { db, sessions, users } from '../../db/index.js';

describe('Session Auth Plugin', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await db.delete(sessions);
    await db.delete(users);
    await app.close();
  });

  describe('Protected routes', () => {
    it('should reject request with missing session cookie', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/orders',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    });

    it('should reject request with invalid session token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/orders',
        cookies: {
          sid: 'invalid-token-12345',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        error: 'Unauthorized',
      });
    });

    it('should reject request with expired session', async () => {
      const passwordHash = await argon2.hash('password123', { type: argon2.argon2id });
      const testUser = await createTestUser({
        email: 'test@example.com',
        password: passwordHash,
        salt: '',
      });

      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      const session = await createTestSession({
        userId: testUser.id,
        expiresAt: expiredDate,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/orders',
        cookies: {
          sid: session.token,
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        error: 'Unauthorized',
        message: 'Session expired',
      });

      const sessionsInDb = await db.select().from(sessions);
      expect(sessionsInDb).toHaveLength(0);
    });

    it('should accept request with valid session and attach user', async () => {
      const passwordHash = await argon2.hash('password123', { type: argon2.argon2id });
      const testUser = await createTestUser({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: passwordHash,
        salt: '',
      });

      const session = await createTestSession({
        userId: testUser.id,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/orders',
        cookies: {
          sid: session.token,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should update sliding expiry on valid request', async () => {
      const passwordHash = await argon2.hash('password123', { type: argon2.argon2id });
      const testUser = await createTestUser({
        email: 'test@example.com',
        password: passwordHash,
        salt: '',
      });

      const session = await createTestSession({
        userId: testUser.id,
      });

      const sessionsBefore = await db.select().from(sessions);
      const originalExpiresAt = sessionsBefore[0]?.expiresAt;
      const originalLastUsedAt = sessionsBefore[0]?.lastUsedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      await app.inject({
        method: 'GET',
        url: '/api/orders',
        cookies: {
          sid: session.token,
        },
      });

      const sessionsAfter = await db.select().from(sessions);
      const updatedExpiresAt = sessionsAfter[0]?.expiresAt;
      const updatedLastUsedAt = sessionsAfter[0]?.lastUsedAt;

      expect(updatedExpiresAt).not.toEqual(originalExpiresAt);
      expect(updatedLastUsedAt).not.toEqual(originalLastUsedAt);
      expect(new Date(updatedExpiresAt || 0).getTime()).toBeGreaterThan(
        new Date(originalExpiresAt || 0).getTime()
      );
    });
  });

  describe('Public routes', () => {
    it('should allow access to public routes without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/products',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should allow access to auth routes without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(201);
    });
  });
});
