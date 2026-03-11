import { cartContract } from '@mercado/api-contracts';
import { initServer } from '@ts-rest/fastify';
import { tsRestRouterOptions } from '../../../config/server.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createModuleLogger } from '../../../lib/logger.js';
import { authService } from '../../auth/services/auth.service.js';
import type { CartIdentifier } from '../domain/cart.types.js';
import {
  CartItemNotFoundError,
  CartNotFoundError,
  CurrencyMismatchError,
  cartService,
  ProductNotAvailableError,
  ProductNotFoundError,
} from '../services/cart.service.js';

const logger = createModuleLogger('cart');

const s = initServer();

const CART_TOKEN_COOKIE_NAME = 'cart_token';

/**
 * Set cart token cookie on response
 */
function setCartTokenCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(CART_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] !== 'development',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 90,
  });
}

/**
 * Extract cart identifier from request
 * Checks for authenticated user (session cookie) first, then cart_token cookie (guest)
 */
async function extractCartIdentifier(request: FastifyRequest): Promise<CartIdentifier> {
  // Check if user is already authenticated via session plugin
  if (request.user) {
    return { type: 'user', userId: request.user.id };
  }

  // Check for session cookie to resolve user (cart routes are public, so session plugin isn't active)
  const sessionToken = request.cookies['sid'];
  if (sessionToken) {
    try {
      const user = await authService.validateSession(sessionToken);
      return { type: 'user', userId: user.id };
    } catch {
      // Session invalid or expired, treat as guest
    }
  }

  // Fallback to guest cart token
  const cartToken = request.cookies[CART_TOKEN_COOKIE_NAME];
  if (cartToken) {
    return { type: 'guest', cartToken };
  }

  return { type: 'guest' };
}

/**
 * Extract authenticated user ID from request
 * Returns null if not authenticated
 */
async function extractAuthenticatedUserId(request: FastifyRequest): Promise<string | null> {
  if (request.user) {
    return request.user.id;
  }

  const sessionToken = request.cookies['sid'];
  if (sessionToken) {
    try {
      const user = await authService.validateSession(sessionToken);
      return user.id;
    } catch {
      // Session invalid or expired
    }
  }

  return null;
}

const router = s.router(cartContract, {
  getCart: async ({ request }) => {
    try {
      const identifier = await extractCartIdentifier(request);
      const cart = await cartService.getCart(identifier);

      return {
        status: 200 as const,
        body: cart,
      };
    } catch (error) {
      logger.error({ error }, 'Unexpected error in get cart route');
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  addItem: async ({ request, body }) => {
    try {
      const identifier = await extractCartIdentifier(request);
      const result = await cartService.addItem(identifier, body.productId, body.quantity);

      // Store newCartToken on request for onSend hook to set cookie
      if (result.newCartToken) {
        (request as FastifyRequest & { newCartToken?: string }).newCartToken = result.newCartToken;
      }

      return {
        status: 200 as const,
        body: result,
      };
    } catch (error) {
      if (error instanceof ProductNotFoundError) {
        return {
          status: 404 as const,
          body: {
            error: 'Product not found',
          },
        };
      }

      if (error instanceof ProductNotAvailableError) {
        return {
          status: 422 as const,
          body: {
            error: 'Product is not available',
          },
        };
      }

      if (error instanceof CurrencyMismatchError) {
        return {
          status: 422 as const,
          body: {
            error: 'Product currency does not match cart currency',
          },
        };
      }

      logger.error({ error, body }, 'Unexpected error in add item route');
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  updateItem: async ({ request, params, body }) => {
    try {
      const identifier = await extractCartIdentifier(request);
      const cart = await cartService.updateItemQuantity(identifier, params.itemId, body.quantity);

      return {
        status: 200 as const,
        body: cart,
      };
    } catch (error) {
      if (error instanceof CartNotFoundError) {
        return {
          status: 404 as const,
          body: {
            error: 'Cart not found',
          },
        };
      }

      if (error instanceof CartItemNotFoundError) {
        return {
          status: 404 as const,
          body: {
            error: 'Cart item not found',
          },
        };
      }

      logger.error({ error, params, body }, 'Unexpected error in update item route');
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  removeItem: async ({ request, params }) => {
    try {
      const identifier = await extractCartIdentifier(request);
      const cart = await cartService.removeItem(identifier, params.itemId);

      return {
        status: 200 as const,
        body: cart,
      };
    } catch (error) {
      if (error instanceof CartNotFoundError) {
        return {
          status: 404 as const,
          body: {
            error: 'Cart not found',
          },
        };
      }

      if (error instanceof CartItemNotFoundError) {
        return {
          status: 404 as const,
          body: {
            error: 'Cart item not found',
          },
        };
      }

      logger.error({ error, params }, 'Unexpected error in remove item route');
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  mergeCart: async ({ request, body }) => {
    try {
      const userId = await extractAuthenticatedUserId(request);

      if (!userId) {
        return {
          status: 401 as const,
          body: {
            error: 'Authentication required',
          },
        };
      }

      const cart = await cartService.mergeGuestCart(userId, body.cartToken);

      return {
        status: 200 as const,
        body: cart,
      };
    } catch (error) {
      if (error instanceof CartNotFoundError) {
        return {
          status: 404 as const,
          body: {
            error: 'Guest cart not found',
          },
        };
      }

      logger.error({ error, body }, 'Unexpected error in merge cart route');
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },
});

/**
 * Register cart routes with Fastify instance
 */
export function registerCartRoutes(fastify: FastifyInstance) {
  // Add onSend hook to set cart token cookie when newCartToken is present
  fastify.addHook('onSend', (request, reply, _payload, done) => {
    const req = request as FastifyRequest & { newCartToken?: string };
    if (req.newCartToken) {
      setCartTokenCookie(reply, req.newCartToken);
    }
    done();
  });

  return s.registerRouter(cartContract, router, fastify, tsRestRouterOptions);
}
