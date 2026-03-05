import { cartContract } from '@mercado/api-contracts';
import { initServer } from '@ts-rest/fastify';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  extractBearerToken,
  extractUserContext,
  validateToken,
} from '../../../infra/auth/token-validator.js';
import { logger } from '../../../lib/logger.js';
import type { CartIdentifier } from '../domain/cart.types.js';
import {
  CartItemNotFoundError,
  CartNotFoundError,
  CurrencyMismatchError,
  cartService,
  ProductNotAvailableError,
  ProductNotFoundError,
} from '../services/cart.service.js';

const s = initServer();

/**
 * Extract cart identifier from request
 * Checks Authorization header first (authenticated user), then x-cart-token (guest)
 */
function extractCartIdentifier(request: FastifyRequest): CartIdentifier {
  const authHeader = request.headers.authorization;

  if (authHeader) {
    const token = extractBearerToken(authHeader);
    if (token && validateToken(token)) {
      const userContext = extractUserContext(request);
      if (userContext.userId) {
        return { type: 'user', userId: userContext.userId };
      }
    }
  }

  const cartToken = request.headers['x-cart-token'] as string | undefined;
  if (cartToken) {
    return { type: 'guest', cartToken };
  }
  return { type: 'guest' };
}

/**
 * Extract authenticated user ID from request
 * Returns null if not authenticated
 */
function extractAuthenticatedUserId(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;

  if (authHeader) {
    const token = extractBearerToken(authHeader);
    if (token && validateToken(token)) {
      const userContext = extractUserContext(request);
      return userContext.userId || null;
    }
  }

  return null;
}

const router = s.router(cartContract, {
  getCart: async ({ request }) => {
    try {
      const identifier = extractCartIdentifier(request);
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
      const identifier = extractCartIdentifier(request);
      const result = await cartService.addItem(identifier, body.productId, body.quantity);

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
      const identifier = extractCartIdentifier(request);
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
      const identifier = extractCartIdentifier(request);
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

  clearCart: async ({ request }) => {
    try {
      const identifier = extractCartIdentifier(request);
      await cartService.clearCart(identifier);

      return {
        status: 200 as const,
        body: {
          success: true,
        },
      };
    } catch (error) {
      logger.error({ error }, 'Unexpected error in clear cart route');
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
      const userId = extractAuthenticatedUserId(request);

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
  return s.registerRouter(cartContract, router, fastify, {
    logInitialization: true,
  });
}
