/**
 * Type definitions for session-based authentication
 */

/**
 * Authenticated user context from session cookie
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
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
