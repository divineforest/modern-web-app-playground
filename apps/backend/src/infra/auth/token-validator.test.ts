import type { FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  extractBearerToken,
  extractUserContext,
  initializeTokens,
  resetTokenCache,
  validateToken,
} from './token-validator.js';

describe('Token Validator', () => {
  beforeEach(() => {
    // Reset token cache before each test
    resetTokenCache();
    // Reset env to empty to ensure tests start fresh
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    // Clean up after each test
    vi.unstubAllEnvs();
    resetTokenCache();
  });

  describe('initializeTokens', () => {
    it('should parse single token from environment', () => {
      // ARRANGE
      vi.stubEnv('API_BEARER_TOKENS', 'test_token_12345');

      // ACT
      const tokens = initializeTokens();

      // ASSERT
      expect(tokens).toEqual(['test_token_12345']);
    });

    it('should parse multiple comma-separated tokens', () => {
      // ARRANGE
      vi.stubEnv('API_BEARER_TOKENS', 'token1,token2,token3');

      // ACT
      const tokens = initializeTokens();

      // ASSERT
      expect(tokens).toEqual(['token1', 'token2', 'token3']);
    });

    it('should trim whitespace from tokens', () => {
      // ARRANGE
      vi.stubEnv('API_BEARER_TOKENS', '  token1  ,  token2  ,  token3  ');

      // ACT
      const tokens = initializeTokens();

      // ASSERT
      expect(tokens).toEqual(['token1', 'token2', 'token3']);
    });

    it('should filter out empty tokens', () => {
      // ARRANGE
      vi.stubEnv('API_BEARER_TOKENS', 'token1,,token2,  ,token3');

      // ACT
      const tokens = initializeTokens();

      // ASSERT
      expect(tokens).toEqual(['token1', 'token2', 'token3']);
    });

    it('should throw error if no valid tokens configured', () => {
      // ARRANGE
      vi.stubEnv('API_BEARER_TOKENS', '   ,  ,  ');

      // ACT & ASSERT
      expect(() => initializeTokens()).toThrow(
        'API_BEARER_TOKENS environment variable must contain at least one valid token'
      );
    });

    it('should cache tokens after first initialization', () => {
      // ARRANGE
      vi.stubEnv('API_BEARER_TOKENS', 'cached_token');

      // ACT
      const tokens1 = initializeTokens();
      const tokens2 = initializeTokens();

      // ASSERT
      expect(tokens1).toBe(tokens2); // Same reference
    });
  });

  describe('validateToken', () => {
    it('should validate token against single configured token', () => {
      // ARRANGE
      vi.stubEnv('API_BEARER_TOKENS', 'test_token_12345');

      // ACT & ASSERT
      expect(validateToken('test_token_12345')).toBe(true);
    });

    it('should reject invalid token', () => {
      // ARRANGE
      vi.stubEnv('API_BEARER_TOKENS', 'test_token_12345');

      // ACT & ASSERT
      expect(validateToken('invalid_token')).toBe(false);
    });

    it('should validate against any token in multiple tokens', () => {
      // ARRANGE
      vi.stubEnv('API_BEARER_TOKENS', 'token1,token2,token3');

      // ACT & ASSERT
      expect(validateToken('token1')).toBe(true);
      expect(validateToken('token2')).toBe(true);
      expect(validateToken('token3')).toBe(true);
    });

    it('should reject token not in configured list', () => {
      // ARRANGE
      vi.stubEnv('API_BEARER_TOKENS', 'token1,token2,token3');

      // ACT & ASSERT
      expect(validateToken('token4')).toBe(false);
    });

    it('should handle empty string token', () => {
      // ARRANGE
      vi.stubEnv('API_BEARER_TOKENS', 'test_token_12345');

      // ACT & ASSERT
      expect(validateToken('')).toBe(false);
    });

    it('should be case-sensitive', () => {
      // ARRANGE
      vi.stubEnv('API_BEARER_TOKENS', 'test_token_12345');

      // ACT & ASSERT
      expect(validateToken('TEST_TOKEN_12345')).toBe(false);
      expect(validateToken('test_token_12345')).toBe(true);
    });

    it('should use constant-time comparison (different lengths)', () => {
      // ARRANGE
      vi.stubEnv('API_BEARER_TOKENS', 'test_token_12345');

      // ACT & ASSERT
      // Should not throw, just return false for different lengths
      expect(validateToken('short')).toBe(false);
      expect(validateToken('very_long_token_that_does_not_match')).toBe(false);
    });

    it('should handle tokens with special characters', () => {
      // ARRANGE
      vi.stubEnv('API_BEARER_TOKENS', 'sk_live_abc123!@#$%^&*()');

      // ACT & ASSERT
      expect(validateToken('sk_live_abc123!@#$%^&*()')).toBe(true);
      expect(validateToken('sk_live_abc123!@#$%^&*')).toBe(false);
    });
  });

  describe('extractBearerToken', () => {
    it('should extract token from valid Bearer authorization header', () => {
      // ARRANGE
      const header = 'Bearer test_token_12345';

      // ACT
      const token = extractBearerToken(header);

      // ASSERT
      expect(token).toBe('test_token_12345');
    });

    it('should return null for undefined header', () => {
      // ARRANGE
      const header = undefined;

      // ACT
      const token = extractBearerToken(header);

      // ASSERT
      expect(token).toBeNull();
    });

    it('should return null for malformed header (no Bearer prefix)', () => {
      // ARRANGE
      const header = 'test_token_12345';

      // ACT
      const token = extractBearerToken(header);

      // ASSERT
      expect(token).toBeNull();
    });

    it('should return null for malformed header (wrong prefix)', () => {
      // ARRANGE
      const header = 'Basic test_token_12345';

      // ACT
      const token = extractBearerToken(header);

      // ASSERT
      expect(token).toBeNull();
    });

    it('should return null for header with only Bearer', () => {
      // ARRANGE
      const header = 'Bearer';

      // ACT
      const token = extractBearerToken(header);

      // ASSERT
      expect(token).toBeNull();
    });

    it('should return null for header with extra spaces', () => {
      // ARRANGE
      const header = 'Bearer  ';

      // ACT
      const token = extractBearerToken(header);

      // ASSERT
      expect(token).toBeNull();
    });

    it('should handle Bearer with extra parts (take only first token)', () => {
      // ARRANGE
      const header = 'Bearer token1 token2';

      // ACT
      const token = extractBearerToken(header);

      // ASSERT
      expect(token).toBeNull(); // Should reject malformed (3 parts)
    });

    it('should be case-sensitive for Bearer prefix', () => {
      // ARRANGE
      const header = 'bearer test_token_12345';

      // ACT
      const token = extractBearerToken(header);

      // ASSERT
      expect(token).toBeNull();
    });
  });

  describe('extractUserContext', () => {
    it('should extract all user headers when provided', () => {
      // ARRANGE
      const mockRequest = {
        headers: {
          'x-user-id': 'user-123',
          'x-user-email': 'test@example.com',
          'x-user-name': 'Test User',
        },
      } as unknown as FastifyRequest;

      // ACT
      const context = extractUserContext(mockRequest);

      // ASSERT
      expect(context).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        authenticated: true,
      });
    });

    it('should handle missing user headers (service-to-service)', () => {
      // ARRANGE
      const mockRequest = {
        headers: {},
      } as unknown as FastifyRequest;

      // ACT
      const context = extractUserContext(mockRequest);

      // ASSERT
      expect(context).toEqual({
        authenticated: true,
      });
    });

    it('should handle partial user headers', () => {
      // ARRANGE
      const mockRequest = {
        headers: {
          'x-user-email': 'test@example.com',
        },
      } as unknown as FastifyRequest;

      // ACT
      const context = extractUserContext(mockRequest);

      // ASSERT
      expect(context).toEqual({
        email: 'test@example.com',
        authenticated: true,
      });
    });

    it('should trim whitespace from headers', () => {
      // ARRANGE
      const mockRequest = {
        headers: {
          'x-user-id': '  user-123  ',
          'x-user-email': '  test@example.com  ',
          'x-user-name': '  Test User  ',
        },
      } as unknown as FastifyRequest;

      // ACT
      const context = extractUserContext(mockRequest);

      // ASSERT
      expect(context).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        authenticated: true,
      });
    });

    it('should treat empty string headers as undefined', () => {
      // ARRANGE
      const mockRequest = {
        headers: {
          'x-user-id': '',
          'x-user-email': '   ',
          'x-user-name': '',
        },
      } as unknown as FastifyRequest;

      // ACT
      const context = extractUserContext(mockRequest);

      // ASSERT
      expect(context).toEqual({
        authenticated: true,
      });
    });

    it('should always set authenticated to true', () => {
      // ARRANGE
      const mockRequest = {
        headers: {},
      } as unknown as FastifyRequest;

      // ACT
      const context = extractUserContext(mockRequest);

      // ASSERT
      expect(context.authenticated).toBe(true);
    });
  });
});
