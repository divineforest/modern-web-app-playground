/**
 * Type definitions for API Bearer token authentication
 */

/**
 * Authenticated user context extracted from request headers
 * Optional user identity can be provided via custom headers for user-initiated requests
 */
export interface AuthenticatedUser {
  /** User ID from X-User-Id header (optional, for user-initiated requests) */
  userId?: string;
  /** User email from X-User-Email header (optional, for user-initiated requests) */
  email?: string;
  /** User display name from X-User-Name header (optional, for user-initiated requests) */
  name?: string;
  /** Request is authenticated via valid API Bearer token */
  authenticated: true;
}

/**
 * Extend Fastify's FastifyRequest interface to include authenticated user
 */
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}
