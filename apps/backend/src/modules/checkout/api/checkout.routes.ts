import { checkoutContract } from '@mercado/api-contracts';
import { initServer } from '@ts-rest/fastify';
import { tsRestRouterOptions } from '../../../config/server.js';
import type { FastifyInstance } from 'fastify';
import { createModuleLogger } from '../../../lib/logger.js';
import {
  CartNotFoundError,
  checkoutService,
  EmptyCartError,
  InactiveProductError,
  OrderNotCheckoutEligibleError,
  OrderNumberGenerationError,
} from '../services/checkout.service.js';

const logger = createModuleLogger('checkout');

const s = initServer();

const CART_TOKEN_COOKIE_NAME = 'cart_token';

const router = s.router(checkoutContract, {
  checkout: async ({ request, body }) => {
    try {
      if (!request.user) {
        return {
          status: 401 as const,
          body: {
            error: 'Authentication required. Please log in to place an order.',
          },
        };
      }

      const cartToken = request.cookies[CART_TOKEN_COOKIE_NAME];
      const result = await checkoutService.checkout(request.user.id, body, cartToken);

      return {
        status: 200 as const,
        body: result,
      };
    } catch (error) {
      if (error instanceof CartNotFoundError) {
        return {
          status: 404 as const,
          body: {
            error: error.message,
          },
        };
      }

      if (error instanceof EmptyCartError) {
        return {
          status: 422 as const,
          body: {
            error: error.message,
          },
        };
      }

      if (error instanceof InactiveProductError) {
        return {
          status: 422 as const,
          body: {
            error: error.message,
          },
        };
      }

      if (error instanceof OrderNotCheckoutEligibleError) {
        return {
          status: 422 as const,
          body: {
            error: error.message,
          },
        };
      }

      if (error instanceof OrderNumberGenerationError) {
        return {
          status: 500 as const,
          body: {
            error: error.message,
          },
        };
      }

      logger.error({ error, body, userId: request.user?.id }, 'Unexpected error in checkout route');
      return {
        status: 500 as const,
        body: {
          error: 'An unexpected error occurred. Please try again.',
        },
      };
    }
  },
});

export function registerCheckoutRoutes(fastify: FastifyInstance) {
  return s.registerRouter(checkoutContract, router, fastify, tsRestRouterOptions);
}
