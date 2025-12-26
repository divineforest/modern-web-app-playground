import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { extractBearerToken, extractUserContext, validateToken } from './token-validator.js';

/**
 * Authentication hook that validates API Bearer tokens
 * Attaches user context to request when valid
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 */
async function authenticationHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;

  // Extract Bearer token from Authorization header
  const token = extractBearerToken(authHeader);

  if (!token) {
    request.log.warn(
      {
        path: request.url,
        method: request.method,
        ip: request.ip,
      },
      'Authentication failed: missing or malformed authorization header'
    );

    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: authHeader ? 'Malformed authentication token' : 'Missing authentication token',
    });
  }

  // Validate token using constant-time comparison
  const isValid = validateToken(token);

  if (!isValid) {
    request.log.warn(
      {
        path: request.url,
        method: request.method,
        ip: request.ip,
      },
      'Authentication failed: invalid token'
    );

    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid authentication token',
    });
  }

  // Extract optional user context from custom headers
  const userContext = extractUserContext(request);
  request.user = userContext;

  // Log successful authentication with user context if available
  if (userContext.email) {
    request.log.info(
      {
        path: request.url,
        method: request.method,
        user: userContext.email,
        userId: userContext.userId,
      },
      'Authentication successful'
    );
  } else {
    request.log.info(
      {
        path: request.url,
        method: request.method,
      },
      'Authentication successful (service-to-service)'
    );
  }
}

/**
 * Fastify plugin that adds API Bearer token authentication
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
const authPluginImplementation: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Register authentication hook for all routes in this plugin scope
  fastify.addHook('onRequest', authenticationHook);

  fastify.log.info('API Bearer token authentication plugin registered');
};

/**
 * Export as Fastify plugin with encapsulation
 */
export const authPlugin = fp(authPluginImplementation, {
  name: 'api-bearer-auth',
  fastify: '5.x',
});
