import { checkoutContract } from '@mercado/api-contracts';
import { initServer } from '@ts-rest/fastify';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { extractUserContext } from '../../../infra/auth/token-validator.js';
import { logger } from '../../../lib/logger.js';
import {
  CartNotFoundError,
  checkoutService,
  EmptyCartError,
  InactiveProductError,
  OrderNotCheckoutEligibleError,
  OrderNumberGenerationError,
} from '../services/checkout.service.js';

const s = initServer();

function extractUserId(request: FastifyRequest): string | null {
  const userContext = extractUserContext(request);
  return userContext.userId || null;
}

const router = s.router(checkoutContract, {
  checkout: async ({ request, body }) => {
    const userId = extractUserId(request);

    try {
      if (!userId) {
        return {
          status: 401 as const,
          body: {
            error: 'Authentication required. Please log in to place an order.',
          },
        };
      }

      const cartToken = request.headers['x-cart-token'] as string | undefined;
      const result = await checkoutService.checkout(userId, body, cartToken);

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

      logger.error({ error, body, userId }, 'Unexpected error in checkout route');
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
  return s.registerRouter(checkoutContract, router, fastify, {
    logInitialization: true,
  });
}
