import argon2 from 'argon2';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestProduct } from '../../../../tests/factories/products.js';
import { createTestSession } from '../../../../tests/factories/sessions.js';
import { createTestUser } from '../../../../tests/factories/users.js';
import { buildTestApp } from '../../../app.js';
import { db, orderItems, orders, products, sessions, users } from '../../../db/index.js';
import { addItemToCart } from '../../cart/services/cart.service.js';

describe('Auth Routes Integration', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(sessions);
    await db.delete(users);
    await db.delete(products);
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user and set session cookie', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toMatchObject({
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isAdmin: false,
      });

      const setCookieHeader = response.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader).toContain('sid=');
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader).toContain('SameSite=Lax');
    });

    it('should reject registration with duplicate email', async () => {
      await createTestUser({ email: 'existing@example.com' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'existing@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        error: 'An account with this email address already exists',
      });
    });

    it('should reject registration with short password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          password: 'short',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should allow access to protected route after registration', async () => {
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          password: 'password123',
        },
      });

      expect(registerResponse.statusCode).toBe(201);

      const cookies = registerResponse.cookies;
      const sessionCookie = cookies.find((c) => c.name === 'sid');

      expect(sessionCookie).toBeDefined();

      const protectedResponse = await app.inject({
        method: 'GET',
        url: '/api/orders',
        cookies: {
          sid: sessionCookie?.value || '',
        },
      });

      expect(protectedResponse.statusCode).toBe(200);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      const passwordHash = await argon2.hash('password123', { type: argon2.argon2id });
      await createTestUser({
        email: 'test@example.com',
        password: passwordHash,
        salt: '',
      });
    });

    it('should login with valid credentials and set session cookie', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.email).toBe('test@example.com');

      const setCookieHeader = response.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader).toContain('sid=');
    });

    it('should reject login with wrong password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'wrongpassword',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        error: 'Invalid email or password',
      });
    });

    it('should reject login with unknown email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'unknown@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        error: 'Invalid email or password',
      });
    });

    it('should merge guest cart on login', async () => {
      const testProduct = await createTestProduct({
        status: 'active',
        name: 'Test Product',
        price: '25.00',
        currency: 'EUR',
      });

      const guestCartResult = await addItemToCart({ type: 'guest' }, testProduct.id, 2, db);
      const guestCartToken = guestCartResult.newCartToken;

      expect(guestCartToken).toBeDefined();

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
        cookies: {
          cart_token: guestCartToken || '',
        },
      });

      expect(loginResponse.statusCode).toBe(200);

      const sessionCookie = loginResponse.cookies.find((c) => c.name === 'sid');
      expect(sessionCookie).toBeDefined();

      const cartResponse = await app.inject({
        method: 'GET',
        url: '/api/cart',
        cookies: {
          sid: sessionCookie?.value || '',
        },
      });

      expect(cartResponse.statusCode).toBe(200);
      const cart = cartResponse.json();
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0]?.quantity).toBe(2);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout and clear session cookie', async () => {
      const passwordHash = await argon2.hash('password123', { type: argon2.argon2id });
      await createTestUser({
        email: 'test@example.com',
        password: passwordHash,
        salt: '',
      });

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      const sessionCookie = loginResponse.cookies.find((c) => c.name === 'sid');
      expect(sessionCookie).toBeDefined();

      const logoutResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        cookies: {
          sid: sessionCookie?.value || '',
        },
      });

      expect(logoutResponse.statusCode).toBe(200);
      expect(logoutResponse.json()).toMatchObject({ success: true });

      const setCookieHeader = logoutResponse.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader).toContain('sid=');
      expect(setCookieHeader).toContain('Max-Age=0');

      const sessionsInDb = await db.select().from(sessions);
      expect(sessionsInDb).toHaveLength(0);

      const protectedResponse = await app.inject({
        method: 'GET',
        url: '/api/orders',
        cookies: {
          sid: sessionCookie?.value || '',
        },
      });

      expect(protectedResponse.statusCode).toBe(401);
    });

    it('should succeed even if no session exists', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ success: true });
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user profile when authenticated', async () => {
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
        url: '/api/auth/me',
        cookies: {
          sid: session.token,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        id: testUser.id,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isAdmin: false,
      });
    });

    it('should reject unauthenticated request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
