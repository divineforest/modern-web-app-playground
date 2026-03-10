import type { LoginInput, RegisterInput, UserProfile } from '@mercado/api-contracts';
import { loginInputSchema, registerInputSchema } from '@mercado/api-contracts';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { env } from '../../../lib/env.js';
import { createModuleLogger } from '../../../lib/logger.js';
import {
  authService,
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  UserNotFoundError,
} from '../services/auth.service.js';

const logger = createModuleLogger('auth');

const SESSION_COOKIE_NAME = 'sid';
const CART_TOKEN_COOKIE_NAME = 'cart_token';

/**
 * Calculate Max-Age in seconds based on session expiry days
 */
function getSessionMaxAge(): number {
  return env.SESSION_EXPIRY_DAYS * 24 * 60 * 60;
}

/**
 * Set session cookie on response
 */
function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV !== 'development',
    sameSite: 'lax',
    path: '/',
    maxAge: getSessionMaxAge(),
  });
}

/**
 * Clear session cookie from response
 */
function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE_NAME, {
    path: '/',
  });
}

/**
 * Clear cart token cookie from response
 */
function clearCartTokenCookie(reply: FastifyReply): void {
  reply.clearCookie(CART_TOKEN_COOKIE_NAME, {
    path: '/',
  });
}

/**
 * Register auth routes with Fastify
 */
export async function registerAuthRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/auth/register - Register new user
   */
  fastify.post<{
    Body: RegisterInput;
    Reply: UserProfile | { error: string };
  }>('/api/auth/register', async (request, reply) => {
    try {
      // Validate request body
      const validatedInput = registerInputSchema.parse(request.body);

      const { user, sessionToken } = await authService.register(validatedInput);

      setSessionCookie(reply, sessionToken);

      logger.info({ userId: user.id }, 'Registration successful');

      return reply.status(201).send(user);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          error: error.errors[0]?.message || 'Validation failed',
        });
      }

      if (error instanceof EmailAlreadyExistsError) {
        return reply.status(409).send({
          error: error.message,
        });
      }

      logger.error(
        { error, body: { email: request.body.email } },
        'Unexpected error in register route'
      );
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });

  /**
   * POST /api/auth/login - Login user
   */
  fastify.post<{
    Body: LoginInput;
    Reply: UserProfile | { error: string };
  }>('/api/auth/login', async (request, reply) => {
    try {
      // Validate request body
      const validatedInput = loginInputSchema.parse(request.body);

      const cartToken = request.cookies[CART_TOKEN_COOKIE_NAME];
      const { user, sessionToken, cartMerged } = await authService.login(validatedInput, cartToken);

      setSessionCookie(reply, sessionToken);

      if (cartMerged && cartToken) {
        clearCartTokenCookie(reply);
      }

      logger.info({ userId: user.id, cartMerged }, 'Login successful');

      return reply.status(200).send(user);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          error: error.errors[0]?.message || 'Validation failed',
        });
      }

      if (error instanceof InvalidCredentialsError) {
        return reply.status(401).send({
          error: error.message,
        });
      }

      logger.error(
        { error, body: { email: request.body.email } },
        'Unexpected error in login route'
      );
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });

  /**
   * POST /api/auth/logout - Logout user
   */
  fastify.post<{
    Reply: { success: boolean } | { error: string };
  }>('/api/auth/logout', async (request, reply) => {
    try {
      const token = request.cookies[SESSION_COOKIE_NAME];

      if (token) {
        await authService.logout(token);
      }

      clearSessionCookie(reply);

      return reply.status(200).send({ success: true });
    } catch (error) {
      logger.error({ error }, 'Unexpected error in logout route');
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });

  /**
   * GET /api/auth/me - Get current user (protected)
   */
  await fastify.register(async (protectedScope) => {
    await protectedScope.register((await import('../../../infra/auth/index.js')).authPlugin);

    protectedScope.get<{
      Reply: UserProfile | { error: string };
    }>('/api/auth/me', async (request, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            error: 'Authentication required',
          });
        }

        const user = await authService.getMe(request.user.id);

        return reply.status(200).send(user);
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return reply.status(401).send({
            error: 'User not found',
          });
        }

        logger.error({ error }, 'Unexpected error in me route');
        return reply.status(500).send({
          error: 'Internal server error',
        });
      }
    });
  });

  logger.info('Auth routes registered');
}
