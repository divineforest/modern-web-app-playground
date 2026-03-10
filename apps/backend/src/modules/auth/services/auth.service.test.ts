import { randomBytes, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestUser } from '../../../../tests/factories/users.js';
import { db, sessions, users } from '../../../db/index.js';
import {
  EmailAlreadyExistsError,
  getMe,
  InvalidCredentialsError,
  login,
  logout,
  register,
  SessionExpiredError,
  SessionNotFoundError,
  UserNotFoundError,
  validateSession,
} from './auth.service.js';

describe('Auth Service', () => {
  afterEach(async () => {
    await db.delete(sessions);
    await db.delete(users);
  });

  describe('register', () => {
    it('should successfully register a new user and create session', async () => {
      const input = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
      };

      const result = await register(input, db);

      expect(result.user).toMatchObject({
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isAdmin: false,
      });
      expect(result.user.id).toBeDefined();
      expect(result.user.createdAt).toBeDefined();
      expect(result.sessionToken).toBeDefined();
      expect(result.sessionToken).toHaveLength(64);

      const usersInDb = await db.select().from(users);
      expect(usersInDb).toHaveLength(1);
      expect(usersInDb[0]?.email).toBe('john@example.com');

      const sessionsInDb = await db.select().from(sessions);
      expect(sessionsInDb).toHaveLength(1);
      expect(sessionsInDb[0]?.token).toBe(result.sessionToken);
    });

    it('should reject registration with duplicate email', async () => {
      await createTestUser({ email: 'existing@example.com' });

      const input = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'existing@example.com',
        password: 'password123',
      };

      await expect(register(input, db)).rejects.toThrow(EmailAlreadyExistsError);
    });

    it('should hash password with argon2id', async () => {
      const input = {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'password123',
      };

      await register(input, db);

      const usersInDb = await db.select().from(users);
      const storedHash = usersInDb[0]?.password;

      expect(storedHash).toBeDefined();
      expect(storedHash).not.toBe('password123');

      const isValid = await argon2.verify(storedHash || '', 'password123');
      expect(isValid).toBe(true);
    });
  });

  describe('login', () => {
    const testPassword = 'password123';
    const testEmail = 'login-test@example.com';

    beforeEach(async () => {
      const passwordHash = await argon2.hash(testPassword, { type: argon2.argon2id });
      await createTestUser({
        email: testEmail,
        password: passwordHash,
        salt: '',
      });
    });

    it('should successfully log in with valid credentials', async () => {
      const input = {
        email: testEmail,
        password: testPassword,
      };

      const result = await login(input, undefined, db);

      expect(result.user).toMatchObject({
        email: testEmail,
        isAdmin: false,
      });
      expect(result.user.id).toBeDefined();
      expect(result.user.firstName).toBeDefined();
      expect(result.user.lastName).toBeDefined();
      expect(result.sessionToken).toBeDefined();
      expect(result.sessionToken).toHaveLength(64);
      expect(result.cartMerged).toBe(false);

      const sessionsInDb = await db.select().from(sessions);
      expect(sessionsInDb).toHaveLength(1);
    });

    it('should reject login with unknown email', async () => {
      const input = {
        email: 'unknown@example.com',
        password: testPassword,
      };

      await expect(login(input, undefined, db)).rejects.toThrow(InvalidCredentialsError);
    });

    it('should reject login with wrong password', async () => {
      const input = {
        email: testEmail,
        password: 'wrongpassword',
      };

      await expect(login(input, undefined, db)).rejects.toThrow(InvalidCredentialsError);
    });

    it('should have similar timing for not-found and wrong-password paths', async () => {
      const unknownEmailInput = {
        email: 'unknown@example.com',
        password: testPassword,
      };

      const wrongPasswordInput = {
        email: testEmail,
        password: 'wrongpassword',
      };

      const start1 = Date.now();
      await login(unknownEmailInput, undefined, db).catch(() => {});
      const duration1 = Date.now() - start1;

      const start2 = Date.now();
      await login(wrongPasswordInput, undefined, db).catch(() => {});
      const duration2 = Date.now() - start2;

      expect(Math.abs(duration1 - duration2)).toBeLessThan(100);
    });
  });

  describe('logout', () => {
    it('should delete session when logging out', async () => {
      const testEmail = 'logout-test@example.com';
      const passwordHash = await argon2.hash('password123', { type: argon2.argon2id });
      await createTestUser({
        email: testEmail,
        password: passwordHash,
        salt: '',
      });

      const loginResult = await login({ email: testEmail, password: 'password123' }, undefined, db);

      await logout(loginResult.sessionToken, db);

      const sessionsInDb = await db.select().from(sessions);
      expect(sessionsInDb).toHaveLength(0);
    });

    it('should not throw error when logging out with non-existent session', async () => {
      const fakeToken = randomUUID();
      await expect(logout(fakeToken, db)).resolves.not.toThrow();
    });
  });

  describe('getMe', () => {
    it('should return user profile by user ID', async () => {
      const testUser = await createTestUser({
        email: 'getme-test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      const profile = await getMe(testUser.id, db);

      expect(profile).toMatchObject({
        id: testUser.id,
        email: 'getme-test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isAdmin: false,
      });
      expect(profile.createdAt).toBeDefined();
    });

    it('should throw UserNotFoundError for non-existent user', async () => {
      await expect(getMe(randomUUID(), db)).rejects.toThrow(UserNotFoundError);
    });
  });

  describe('validateSession', () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;
    let sessionToken: string;
    const testEmail = 'validate-test@example.com';

    beforeEach(async () => {
      const passwordHash = await argon2.hash('password123', { type: argon2.argon2id });
      testUser = await createTestUser({
        email: testEmail,
        password: passwordHash,
        salt: '',
      });

      const loginResult = await login({ email: testEmail, password: 'password123' }, undefined, db);
      sessionToken = loginResult.sessionToken;
    });

    it('should validate non-expired session and update sliding expiry', async () => {
      const profile = await validateSession(sessionToken, db);

      expect(profile).toMatchObject({
        id: testUser.id,
        email: testEmail,
      });

      const sessionsInDb = await db.select().from(sessions);
      expect(sessionsInDb).toHaveLength(1);
      expect(sessionsInDb[0]?.lastUsedAt).toBeDefined();
    });

    it('should reject unknown token', async () => {
      const fakeToken = randomBytes(32).toString('hex');
      await expect(validateSession(fakeToken, db)).rejects.toThrow(SessionNotFoundError);
    });

    it('should reject expired session', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      // Expire the current session
      await db
        .update(sessions)
        .set({ expiresAt: expiredDate })
        .where(eq(sessions.token, sessionToken));

      await expect(validateSession(sessionToken, db)).rejects.toThrow(SessionExpiredError);

      // The expired session should have been deleted
      const sessionsAfter = await db
        .select()
        .from(sessions)
        .where(eq(sessions.token, sessionToken));
      expect(sessionsAfter).toHaveLength(0);
    });
  });
});
