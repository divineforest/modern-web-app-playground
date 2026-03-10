import type { FastifyInstance, FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import {
  authService,
  SessionExpiredError,
  SessionNotFoundError,
} from '../../modules/auth/services/auth.service.js';

/**
 * Authentication hook that validates session cookies
 * Attaches user context to request when valid
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 */
async function authenticationHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const sessionToken = request.cookies['sid'];

  if (!sessionToken) {
    request.log.warn(
      {
        path: request.url,
        method: request.method,
        ip: request.ip,
      },
      'Authentication failed: missing session cookie'
    );

    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  try {
    // Validate session and update sliding expiry
    const user = await authService.validateSession(sessionToken);

    request.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isAdmin: user.isAdmin,
      authenticated: true,
    };

    request.log.info(
      {
        path: request.url,
        method: request.method,
        userId: user.id,
        email: user.email,
      },
      'Authentication successful'
    );
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      request.log.warn(
        {
          path: request.url,
          method: request.method,
          ip: request.ip,
        },
        'Authentication failed: session not found'
      );

      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (error instanceof SessionExpiredError) {
      request.log.warn(
        {
          path: request.url,
          method: request.method,
          ip: request.ip,
        },
        'Authentication failed: session expired'
      );

      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Session expired',
      });
    }

    request.log.error(
      {
        path: request.url,
        method: request.method,
        ip: request.ip,
        error,
      },
      'Authentication failed: unexpected error'
    );

    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }
}

/**
 * Fastify plugin that adds session-cookie authentication
 * All routes registered after this plugin will require authentication
 *
 * Usage:
 * ```typescript
 * // Register unprotected routes first
 * await fastify.register(healthRoutes);
 *
 * // Register auth plugin
 * await fastify.register(authPlugin);
 *
 * // All routes registered after this point require authentication
 * await fastify.register(protectedRoutes);
 * ```
 */
const authPluginImplementation: FastifyPluginCallback = (fastify: FastifyInstance) => {
  // Register authentication hook for all routes in this plugin scope
  fastify.addHook('onRequest', authenticationHook);

  fastify.log.info('Session-cookie authentication plugin registered');
};

/**
 * Export as Fastify plugin with encapsulation
 */
export const authPlugin = fp(authPluginImplementation, {
  name: 'session-cookie-auth',
  fastify: '5.x',
});
