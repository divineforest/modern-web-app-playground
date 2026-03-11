import { authContract } from '@mercado/api-contracts';
import { initServer } from '@ts-rest/fastify';
import { tsRestRouterOptions } from '../../../config/server.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../../lib/env.js';
import { createModuleLogger } from '../../../lib/logger.js';
import {
  authService,
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  SessionExpiredError,
  SessionNotFoundError,
  UserNotFoundError,
} from '../services/auth.service.js';

const logger = createModuleLogger('auth');

const s = initServer();

const SESSION_COOKIE_NAME = 'sid';
const CART_TOKEN_COOKIE_NAME = 'cart_token';

type AuthCookieAction =
  | { action: 'set-session'; token: string }
  | { action: 'clear-session' }
  | { action: 'clear-cart-token' };

function getSessionMaxAge(): number {
  return env.SESSION_EXPIRY_DAYS * 24 * 60 * 60;
}

function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV !== 'development',
    sameSite: 'lax',
    path: '/',
    maxAge: getSessionMaxAge(),
  });
}

function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
}

function clearCartTokenCookie(reply: FastifyReply): void {
  reply.clearCookie(CART_TOKEN_COOKIE_NAME, { path: '/' });
}

function applyCookieActions(reply: FastifyReply, actions: AuthCookieAction[]): void {
  for (const action of actions) {
    switch (action.action) {
      case 'set-session':
        setSessionCookie(reply, action.token);
        break;
      case 'clear-session':
        clearSessionCookie(reply);
        break;
      case 'clear-cart-token':
        clearCartTokenCookie(reply);
        break;
    }
  }
}

const router = s.router(authContract, {
  register: async ({ body, request }) => {
    try {
      const { user, sessionToken } = await authService.register(body);

      (request as FastifyRequest & { authCookieActions?: AuthCookieAction[] }).authCookieActions = [
        { action: 'set-session', token: sessionToken },
      ];

      logger.info({ userId: user.id }, 'Registration successful');

      return { status: 201 as const, body: user };
    } catch (error) {
      if (error instanceof EmailAlreadyExistsError) {
        return { status: 409 as const, body: { error: error.message } };
      }

      logger.error({ error, body: { email: body.email } }, 'Unexpected error in register route');
      return { status: 500 as const, body: { error: 'Internal server error' } };
    }
  },

  login: async ({ body, request }) => {
    try {
      const cartToken = request.cookies[CART_TOKEN_COOKIE_NAME];
      const { user, sessionToken, cartMerged } = await authService.login(body, cartToken);

      const cookieActions: AuthCookieAction[] = [{ action: 'set-session', token: sessionToken }];
      if (cartMerged && cartToken) {
        cookieActions.push({ action: 'clear-cart-token' });
      }

      (request as FastifyRequest & { authCookieActions?: AuthCookieAction[] }).authCookieActions =
        cookieActions;

      logger.info({ userId: user.id, cartMerged }, 'Login successful');

      return { status: 200 as const, body: user };
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        return { status: 401 as const, body: { error: error.message } };
      }

      logger.error({ error, body: { email: body.email } }, 'Unexpected error in login route');
      return { status: 500 as const, body: { error: 'Internal server error' } };
    }
  },

  logout: async ({ request }) => {
    try {
      const token = request.cookies[SESSION_COOKIE_NAME];

      if (token) {
        await authService.logout(token);
      }

      (request as FastifyRequest & { authCookieActions?: AuthCookieAction[] }).authCookieActions = [
        { action: 'clear-session' },
      ];

      return { status: 200 as const, body: { success: true } };
    } catch (error) {
      logger.error({ error }, 'Unexpected error in logout route');
      return { status: 500 as const, body: { error: 'Internal server error' } };
    }
  },

  me: async ({ request }) => {
    try {
      // Validate session manually — auth routes are registered in public scope
      const sessionToken = request.cookies[SESSION_COOKIE_NAME];
      if (!sessionToken) {
        return { status: 401 as const, body: { error: 'Authentication required' } };
      }

      let userId: string;
      try {
        const sessionUser = await authService.validateSession(sessionToken);
        userId = sessionUser.id;
      } catch (error) {
        if (error instanceof SessionNotFoundError || error instanceof SessionExpiredError) {
          return { status: 401 as const, body: { error: 'Authentication required' } };
        }
        throw error;
      }

      const user = await authService.getMe(userId);

      return { status: 200 as const, body: user };
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        return { status: 401 as const, body: { error: 'User not found' } };
      }

      logger.error({ error }, 'Unexpected error in me route');
      return { status: 500 as const, body: { error: 'Internal server error' } };
    }
  },
});

/**
 * Register auth routes with Fastify instance
 */
export function registerAuthRoutes(fastify: FastifyInstance) {
  fastify.addHook('onSend', (request, reply, _payload, done) => {
    const req = request as FastifyRequest & { authCookieActions?: AuthCookieAction[] };
    if (req.authCookieActions) {
      applyCookieActions(reply, req.authCookieActions);
    }
    done();
  });

  s.registerRouter(authContract, router, fastify, tsRestRouterOptions);

  logger.info('Auth routes registered');
}
