import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { AuthenticatedUser } from './auth.types.js';

/**
 * Parsed and validated API Bearer tokens from environment configuration
 */
let validTokens: string[] | null = null;

/**
 * Initialize and validate API Bearer tokens from environment
 * Parses comma-separated tokens, trims whitespace, and validates at least one token exists
 *
 * @throws Error if no valid tokens are configured
 */
export function initializeTokens(): string[] {
  if (validTokens !== null) {
    return validTokens;
  }

  // Read directly from process.env for test flexibility
  const tokensString = process.env['API_BEARER_TOKENS'];

  if (!tokensString) {
    throw new Error('API_BEARER_TOKENS environment variable is required');
  }
  validTokens = tokensString
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (validTokens.length === 0) {
    throw new Error('API_BEARER_TOKENS environment variable must contain at least one valid token');
  }

  return validTokens;
}

/**
 * Validate an API Bearer token using constant-time comparison
 * Prevents timing attacks by using crypto.timingSafeEqual
 *
 * @param token - The token to validate
 * @returns true if token is valid, false otherwise
 */
export function validateToken(token: string): boolean {
  const tokens = initializeTokens();

  // Use constant-time comparison to prevent timing attacks
  for (const validToken of tokens) {
    try {
      // Both buffers must be the same length for timingSafeEqual
      if (token.length !== validToken.length) {
        continue;
      }

      const tokenBuffer = Buffer.from(token, 'utf8');
      const validTokenBuffer = Buffer.from(validToken, 'utf8');

      if (timingSafeEqual(tokenBuffer, validTokenBuffer)) {
        return true;
      }
    } catch {
      // Silently continue to next token on any error (e.g., Buffer creation failure)
      // This prevents leaking information about which validation step failed
    }
  }

  return false;
}

/**
 * Extract user context from custom request headers
 * Optional headers for user-initiated requests (service-to-service calls may omit these)
 *
 * @param request - Fastify request object
 * @returns AuthenticatedUser object with optional user identity
 */
export function extractUserContext(request: FastifyRequest): AuthenticatedUser {
  const userId = request.headers['x-user-id'] as string | undefined;
  const email = request.headers['x-user-email'] as string | undefined;
  const name = request.headers['x-user-name'] as string | undefined;

  const trimmedUserId = userId?.trim();
  const trimmedEmail = email?.trim();
  const trimmedName = name?.trim();

  return {
    ...(trimmedUserId && { userId: trimmedUserId }),
    ...(trimmedEmail && { email: trimmedEmail }),
    ...(trimmedName && { name: trimmedName }),
    authenticated: true,
  };
}

/**
 * Extract Bearer token from Authorization header
 *
 * @param authHeader - Authorization header value
 * @returns Extracted token or null if not found/malformed
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1] || null;
}

/**
 * Reset token cache (useful for testing)
 * @internal
 */
export function resetTokenCache(): void {
  validTokens = null;
}
