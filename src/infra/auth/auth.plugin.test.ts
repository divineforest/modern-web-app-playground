import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../lib/env.js';
import { authPlugin } from './auth.plugin.js';
import { resetTokenCache } from './token-validator.js';

describe('Authentication Plugin - Integration Tests', () => {
  let fastify: FastifyInstance;
  const originalTokens = env.API_BEARER_TOKENS;

  beforeEach(async () => {
    // Reset token cache
    resetTokenCache();

    // Set up test tokens
    vi.stubEnv('API_BEARER_TOKENS', 'test_token_12345,another_valid_token');

    // Create fresh Fastify instance
    fastify = Fastify({
      logger: false, // Disable logging in tests
    });

    // Register auth plugin
    await fastify.register(authPlugin);

    // Register test route (protected by auth)
    fastify.get('/test', async () => {
      return { message: 'success' };
    });

    // Register route that accesses user context
    fastify.get('/test/user', async (request) => {
      return {
        message: 'success',
        user: request.user,
      };
    });

    await fastify.ready();
  });

  afterEach(async () => {
    if (fastify) {
      await fastify.close();
    }
    vi.stubEnv('API_BEARER_TOKENS', originalTokens);
    resetTokenCache();
  });

  describe('Valid Authentication', () => {
    it('should allow request with valid token', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: {
          authorization: 'Bearer test_token_12345',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ message: 'success' });
    });

    it('should allow request with any valid token from list', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: {
          authorization: 'Bearer another_valid_token',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ message: 'success' });
    });

    it('should attach user context when headers provided', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/test/user',
        headers: {
          authorization: 'Bearer test_token_12345',
          'x-user-id': 'user-123',
          'x-user-email': 'test@example.com',
          'x-user-name': 'Test User',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.user).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        authenticated: true,
      });
    });

    it('should handle service-to-service calls without user headers', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/test/user',
        headers: {
          authorization: 'Bearer test_token_12345',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.user).toEqual({
        userId: undefined,
        email: undefined,
        name: undefined,
        authenticated: true,
      });
    });

    it('should handle partial user headers', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/test/user',
        headers: {
          authorization: 'Bearer test_token_12345',
          'x-user-email': 'test@example.com',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.user).toEqual({
        userId: undefined,
        email: 'test@example.com',
        name: undefined,
        authenticated: true,
      });
    });
  });

  describe('Missing Authentication', () => {
    it('should return 401 when Authorization header is missing', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      // ASSERT
      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body).toEqual({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Missing authentication token',
      });
    });

    it('should return 401 with empty Authorization header', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: {
          authorization: '',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.message).toBe('Missing authentication token');
    });
  });

  describe('Malformed Authentication', () => {
    it('should return 401 for malformed Authorization header (no Bearer)', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: {
          authorization: 'test_token_12345',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body).toEqual({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Malformed authentication token',
      });
    });

    it('should return 401 for wrong authorization scheme', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: {
          authorization: 'Basic test_token_12345',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.message).toBe('Malformed authentication token');
    });

    it('should return 401 for Bearer without token', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: {
          authorization: 'Bearer',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.message).toBe('Malformed authentication token');
    });

    it('should return 401 for Bearer with empty token', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: {
          authorization: 'Bearer ',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.message).toBe('Malformed authentication token');
    });
  });

  describe('Invalid Authentication', () => {
    it('should return 401 for invalid token', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: {
          authorization: 'Bearer invalid_token',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body).toEqual({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid authentication token',
      });
    });

    it('should return 401 for token not in configured list', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: {
          authorization: 'Bearer some_other_token',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.message).toBe('Invalid authentication token');
    });

    it('should be case-sensitive for tokens', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: {
          authorization: 'Bearer TEST_TOKEN_12345',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(401);
    });
  });
});
